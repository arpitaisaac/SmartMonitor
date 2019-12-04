import { Router } from "express";
import { RoutesCommon, upload } from "./Common.Routes";
import * as Models from "../Models/Models";
import * as fs from "fs";
import * as Path from "path";
import * as Config from "../config/Config";

export const Files = Router();

Files.post(
  "/upload",
  RoutesCommon.IsAuthenticated,
  upload.array("files"),
  async (req, res) => {
    try {
      const files = req.files as any[];
      if (files.length === 0) return res.status(422).send("Upload Failed");

      const params = RoutesCommon.GetParameters(req);
      if (params == null) return res.status(422).send("Upload Failed");

      const startTime = RoutesCommon.TimeToDecimal(params.startTime);
      const endTime = RoutesCommon.TimeToDecimal(params.endTime);
      if (startTime > endTime) return res.status(422).send("Upload Failed");

      // We can change showTime if it's a GIF
      let showTime = RoutesCommon.ConvertStringToIntegralGreaterThanMin(
        params.showTime,
        0 /*Default Time Set*/
      );

      const displayIDs = RoutesCommon.ToArray(params.ids);
      if (displayIDs.length === 0) return res.status(422).send("Upload Failed");

      // Iterate over all the files
      files.forEach(async file => {
        // Path changed if path is a video
        let filePath = String(file.path);

        let extension = Path.extname(filePath).substr(1).toLowerCase(); // Ignores Dot

        let mediaType = RoutesCommon.GetFileMediaType(extension);
        if (!mediaType) return;

        let name = Path.basename(filePath, Path.extname(filePath));
        let location = file.destination;

        // Convert to Mp4 x264 For Java compatibility
        if (mediaType === "VIDEO") {
          const converted = await RoutesCommon.VideoChangeFormatToH264(
            location,
            name,
            extension
          );

          await RoutesCommon.RemoveFileAsync(filePath);
          if (!converted) throw new Error("Video Conversion Failed");

          // We need to Add Video to name as then
          // We need to also convert MP4 Files to New Format
          // But we can't just write into the original file
          name = name + "video";
          extension = "mp4";
          filePath = Path.join(location, name + "." + extension);
        }
        // Get File Hash
        let fileHash = await RoutesCommon.GetSHA256FromFileAsync(filePath);
        // Get File Size
        let fileSize = await RoutesCommon.GetFileSizeInBytes(filePath);

        const fileSame = await Models.Files.findOne({
          where: { FileSize: fileSize, FileHash: fileHash }
        });

        const AlreadyPresentIDs: number[] = [];
        // Same File Found
        if (fileSame) {
          await RoutesCommon.RemoveFileAsync(filePath);

          name = fileSame.Name;
          extension = fileSame.Extension;
          location = fileSame.Location;
          fileHash = fileSame.FileHash;
          fileSize = fileSame.FileSize;
          mediaType = fileSame.MediaType;

          AlreadyPresentIDs.push(fileSame.DisplayID);
        }

        // As it's New File
        // Generate Thumbnail
        if (!fileSame) {
          await RoutesCommon.GenerateThumbnailAsync(
            location,
            name,
            extension,
            mediaType,
            Models.Files.GetThumbnailFileName(name)
          );

          if (extension === "gif") {
            showTime = await RoutesCommon.GIFDuration(filePath, showTime);
          }
        }

        displayIDs.forEach(async displayId => {
          if (AlreadyPresentIDs.includes(displayId))
            // As File getting Reuploaded, rather than doing nothing, we assume
            // It's user's instruction to show the file
            await Models.Files.update(
              {
                OnDisplay: true,
                TimeStart: startTime,
                TimeEnd: endTime,
                ShowTime: showTime
              },
              {
                where: {
                  Name: name,
                  Extension: extension,
                  Location: location,
                  DisplayID: displayId,
                  FileHash: fileHash,
                  FileSize: fileSize,
                  MediaType: mediaType!
                }
              }
            );
          else
            await Models.Files.create({
              Name: name,
              Extension: extension,
              Location: location,
              DisplayID: displayId,
              FileHash: fileHash,
              FileSize: fileSize,
              MediaType: mediaType!,
              OnDisplay: true,
              TimeStart: startTime,
              TimeEnd: endTime,
              ShowTime: showTime,
              Downloaded: false
            });

          RoutesCommon.SendMqttClientDownloadRequest(displayId);
        });
      });

      await RemoveAllOutdatedFilesAbsentInDatabase(Config.Server.MediaStorage);

      return res.status(200).redirect("/files/upload");
    } catch (err) {
      console.error(err);
      return res.status(422).send("Upload Failed");
    }
  }
);

async function RemoveAllOutdatedFilesAbsentInDatabase(storageLocation: string) {
  const FilesInDBObj: any = await Models.Files.aggregate('PathToFile', 'DISTINCT', { plain: false });
  let FilesInDB: string[] = FilesInDBObj.map((file: any) => file.DISTINCT).sort();

  let FilesInDir = await RoutesCommon.ListOfFiles(storageLocation);
  // Remove all Thumbnails from list
  FilesInDir = FilesInDir.filter(file => !Path.basename(file).startsWith("thumb-"));
  FilesInDir = FilesInDir.sort();

  const FilesToRemoveDiscludingThumbnails = FilesInDir.filter((file) => !FilesInDB.includes(file));
  const FilesToRemove: string[] = [];

  for (const file of FilesToRemoveDiscludingThumbnails) {
    FilesToRemove.push(file);
    const pathData = Path.parse(file);
    const thumnNailName = Models.Files.GetThumbnailFileName(pathData.name);
    const thumbNailPath = Path.join(pathData.dir, thumnNailName);
    FilesToRemove.push(thumbNailPath);
  }
  await RoutesCommon.RemoveFilesAsync(FilesToRemove);
}

Files.delete("/remove", RoutesCommon.IsAuthenticated, async (req, res) => {
  const params = RoutesCommon.GetParameters(req);
  const fileId = Number(params.file);
  const displayId = Number(params.id);

  const count = await Models.Files.destroy({
    where: { id: fileId, DisplayID: displayId }
  });

  if (count === 0) return res.json({ success: false });

  RoutesCommon.SendMqttClientUpdateSignal(displayId);
  await RemoveAllOutdatedFilesAbsentInDatabase(Config.Server.MediaStorage);
  return res.json({ success: true });
});

Files.get("/upload/", RoutesCommon.IsAuthenticated, async (req, res) => {
  return RoutesCommon.NoCaching(res).render("ImageUpload.html");
});

// Controls if File is Hidden or Not
Files.put("/shown", RoutesCommon.IsAuthenticated, async (req, res) => {
  try {
    const params = RoutesCommon.GetParameters(req);
    const fileId = Number(params.file);
    const displayId = Number(params.id);
    const show = String(params.show) === "true";

    const [count] = await Models.Files.update(
      { OnDisplay: show },
      {
        where: { id: fileId, DisplayID: displayId, OnDisplay: !show }
      }

    );
    if (count === 0) return res.json({ success: false });

    RoutesCommon.SendMqttClientUpdateSignal(displayId);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.json({ success: false });
  }
});

Files.get("/thumbnail", RoutesCommon.IsAuthenticated, async (req, res) => {
  try {
    const params = RoutesCommon.GetParameters(req);
    const fileId = Number(params.file);
    const displayId = Number(params.id);

    const file = await Models.Files.findOne({
      where: { id: fileId, DisplayID: displayId }
    });
    if (!file) return res.sendStatus(404);

    const path = file.GetThumbnailFileLocation();
    return res.download(path);
  } catch (err) {
    console.error(err);
  }
  return res.sendStatus(404);
});

Files.post(
  "/download/list",
  RoutesCommon.ValidateActualDisplay,
  async (req, res) => {
    const params = RoutesCommon.GetParameters(req);
    const displayId = Number(params.id);

    const files = await Models.Files.findAll({
      attributes: ["id", "Extension", "Name"],
      where: { DisplayID: displayId, Downloaded: false }
    });

    const list: any[] = [];
    files.forEach(file => {
      list.push({ id: file.id, Name: file.Name, Extension: file.Extension });
    });
    return res.json({ success: true, data: list });
  }
);

Files.post(
  "/download/file",
  RoutesCommon.ValidateActualDisplay,
  async (req, res) => {
    const params = RoutesCommon.GetParameters(req);
    const fileId = Number(params.file);
    const displayId = Number(params.id);

    const file = await Models.Files.findOne({
      attributes: ["PathToFile"],
      where: { id: fileId, DisplayID: displayId, Downloaded: false }
    });

    if (!file) return res.sendStatus(404);
    const path = file.PathToFile;
    if (fs.existsSync(path)) return res.download(path);
    return res.sendStatus(404);
  }
);

Files.post(
  "/list/filesFX",
  RoutesCommon.ValidateActualDisplay,
  async (req, res) => {
    try {
      const params = RoutesCommon.GetParameters(req);

      if (params == null)
        return res.json({
          success: false,
          data: []
        });
      const id = Number(params.id);

      const data: any[] = [];
      const files = await Models.Files.findAll({
        where: { DisplayID: id },
        order: [["id", "ASC"]]
      });

      files.forEach(file => {
        data.push({
          file: file.id,
          Path: file.Name + "." + file.Extension,
          Start: file.TimeStart,
          End: file.TimeEnd,
          ShowTime: file.ShowTime,
          OnDisplay: file.OnDisplay
        });
      });

      return res.json({ success: true, data: data });
    } catch (err) {
      console.error(err);
    }
    return res.json({
      success: false,
      data: []
    });
  }
);
