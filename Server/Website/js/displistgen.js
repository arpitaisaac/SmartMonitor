$.getJSON("/display/", function (data) {
  Object.keys(data).forEach(function (count) {
    $("#accordion").accordion({ collapsible: true, heightStyle: "content" });

    var newH3 = document.createElement("h3");
    var rowDiv = document.createElement("div");
    var acc = document.getElementById("accordion");
    rowDiv.setAttribute("id", "acc-div");
    newH3.innerText = data[count].name;

    rowDiv.classList.add("row", "text-center", "text-lg-left");

    var curDisplayId = data[count].id;
    var path = "/display/" + curDisplayId + "/files";
    $.getJSON(path, function (photo) {
      for (var i = 0; i < photo.data.length; i++) {
        var curFileId = photo.data[i].file;
        var dispstat = photo.data[i].OnDisplay;

        var gridDiv = document.createElement("div");
        gridDiv.setAttribute("data-file", curFileId);
        gridDiv.classList.add("col-lg-3", "col-md-4", "col-6", "text-center");

        var imgBlock = document.createElement("img");
        var imgpath =
          "/files/thumbnail?file=" + curFileId + "&id=" + curDisplayId;
        imgBlock.classList.add(
          "img-thumbnail",
          "rounded",
          "mx-auto",
          "d-block"
        );
        imgBlock.setAttribute("src", imgpath);
        imgBlock.setAttribute("width", "160");
        imgBlock.setAttribute("height", "120");
        imgBlock.setAttribute("data-file", curFileId);

        var butHide = document.createElement("a");
        butHide.classList.add("btn", "btn-primary", "mb-4");
        butHide.setAttribute("role", "button");
        butHide.setAttribute("data-id", curDisplayId);
        butHide.setAttribute("data-file", curFileId);
        butHide.setAttribute("data-OnDisplay", dispstat);
        if (dispstat) butHide.innerText = "Hide";
        else butHide.innerText = "Show";
        butHide.onclick = function (objectClicked) {
          var button = objectClicked.target;
          var chng = button.innerText === "Hide";
          var fileId = button.getAttribute("data-file");
          var displayId = button.getAttribute("data-id");
          $.ajax({
            url: "/files/shown",
            type: "PUT",
            dataType: "json",
            data: { file: fileId, id: displayId, show: !chng },
            success: function (data) {
              const success = Boolean(data.success);
              if (success === false) {
                return;
              }
              if (button.innerText === "Hide") button.innerText = "Show";
              else button.innerText = "Hide";
            },
            error: function (jqXHR, exception) {},
          });
        };

        var butDel = document.createElement("a");
        butDel.classList.add("btn", "btn-primary", "mb-4");
        butDel.setAttribute("role", "button");
        butDel.setAttribute("data-id", curDisplayId);
        butDel.setAttribute("data-file", curFileId);

        butDel.onclick = function (objectClicked) {
          var button = objectClicked.target;
          var fileId = button.getAttribute("data-file");
          var displayId = button.getAttribute("data-id");
          $.ajax({
            url:
              "/files/remove" + "?" + $.param({ file: fileId, id: displayId }),
            type: "DELETE",
            success: function (data) {
              const success = Boolean(data.success);
              if (success === false) {
                return;
              }
            },
          });
          document.querySelector("div[data-file='" + fileId + "']").remove();
        };
        butDel.innerText = "Delete";

        gridDiv.appendChild(imgBlock);
        gridDiv.appendChild(butHide);
        gridDiv.appendChild(butDel);
        rowDiv.appendChild(gridDiv);
      }
    });

    acc.appendChild(newH3);
    acc.appendChild(rowDiv);
    $("#accordion").accordion("refresh");
  });
});

$("#addForm").submit(function (e) {
  const displayname = document.getElementById("displayname").value;
  e.preventDefault();
  $.ajax({
    method: "POST",
    url: "/display/",
    dataType: "json",
    data: { displayname: displayname },
    success: function (data) {
      const success = Boolean(data.success);
      console.log(success, data);
    },
  });
});
