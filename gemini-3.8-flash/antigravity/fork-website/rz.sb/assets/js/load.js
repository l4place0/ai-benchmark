
function loadScript(url, callback) {
    var script = document.createElement("script")
    script.type = "text/javascript";
    if (script.readyState) {
        // IE
        script.onreadystatechange = function () {
            if (script.readyState == "loaded" || script.readyState == "complete") {
                script.onreadystatechange = null;
                callback();
            }
        };
    } else {
        // Others
        script.onload = function () {
            callback();
        };
    }
    script.src = url;
    document.body.appendChild(script);
}


loadScript(Config.SrcCdnDir + "src/js/plugins/lazyload.js", function () {
    loadScript(Config.SrcCdnDir + "src/js/plugins/pjax.js", function () {
        loadScript(Config.SrcCdnDir + "src/js/plugins/tokeninput.js", function () {
            loadScript(Config.SrcCdnDir + "src/js/plugins/view-image.min.js", function () {
                loadScript(Config.SrcCdnDir + "src/js/plugins/qq_widget.js", function () {
                    loadScript(Config.SrcCdnDir + "src/js/plugins/flexible.js", function () {
                        loadScript(Config.SrcCdnDir + "src/js/plugins/marked.min.js", function () {
                            loadScript(Config.SrcCdnDir + "src/js/plugins/tinymce/tinymce.min.js", function () {
                                loadScript($('#scriptUrl').attr('content'), function () { });
                            });
                        });
                    });
                });
            });
        });
    });
});