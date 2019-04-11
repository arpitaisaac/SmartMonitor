$.getJSON("/display/", function(data) {
  Object.keys(data).forEach(function(count) {
    $("#accordion").accordion({ collapsible: true, heightStyle: "content" });

    var newH3 = document.createElement("h3");
    var rowDiv = document.createElement("div");
    var acc = document.getElementById("accordion");
    rowDiv.setAttribute("id", "acc-div");
    newH3.innerText = data[count].name;

    rowDiv.classList.add("row", "text-center", "text-lg-left");

    var id = data[count].id;
    var path = "/display/" + id + "/files";
    $.getJSON(path, function(photo) {
      for (var i = 0; i < photo.data.length; i++) {
        var iden2 = photo.data[i].file;
        var dispstat = photo.data[i].OnDisplay;

        var gridDiv = document.createElement("div");
        gridDiv.classList.add("col-lg-3", "col-md-4", "col-6");

        var aBlock = document.createElement("a");
        aBlock.classList.add("d-block", "mb-4");

        var imgBlock = document.createElement("img");
        var imgpath = "/files/thumbnail?file=" + iden2 + "&id=" + id;
        imgBlock.setAttribute("src", imgpath);
        aBlock.classList.add("img-fluid", "img-thumbnail");

        var butHide = document.createElement("a");
        butHide.classList.add("btn", "btn-primary");
        butHide.setAttribute("role", "button");
        butHide.setAttribute("data-id", id);
        butHide.setAttribute("data-file", iden2);
        butHide.setAttribute("data-OnDisplay", dispstat);
        if (dispstat) butHide.innerText = "Hide";
        else butHide.innerText = "Show";
        butHide.onclick = function(objectClicked) {
          var button = objectClicked.target;
          var chng = button.innerText === "Hide";
          var fileId = button.getAttribute("data-file");
          var displayId = button.getAttribute("data-id");
          $.ajax({
            url: "/files/shown",
            type: "PUT",
            dataType: "json",
            data: { file: fileId, id: displayId, show: !chng },
            success: function(data) {
              const success = Boolean(data.success);
              if (success === false) {
                console.error("Unable to hide");
                return;
              }
              if (button.innerText === "Hide")
                button.innerText = "Show";
              else button.innerText = "Hide";
            },
            error: function(jqXHR, exception) {
              console.error("Unable to hide ", jqXHR, exception);
            }
          });
        };

        var butDel = document.createElement("a");
        butDel.classList.add("btn", "btn-primary");
        butDel.setAttribute("role", "button");
        butDel.setAttribute("data-id", id);
        butDel.setAttribute("data-file", iden2);
        butDel.setAttribute("data-OnDisplay", dispstat);

        butDel.onclick = function(objectClicked) {
          var button = objectClicked.target;
          var fileId = button.getAttribute("data-file");
          var displayId = button.getAttribute("data-id");
          $.ajax({
            url: "/files/remove" + "?" + $.param({ file: fileId, id: displayId }),
            type: "DELETE",
            success: function(data) {
              const success = Boolean(data.success);
              if (success === false) {
                console.error("Unable to Delete");
                return;
              }
            }
          });
        };
        butDel.innerText = "Delete";

        aBlock.appendChild(imgBlock);
        gridDiv.appendChild(aBlock);
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
