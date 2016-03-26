/**
 * SDK Runner Javascript.
 */

$(document).ready(function() {

    refresh_tenant_list();
    refresh_fiddles_list();

    $('a.add-tenant').click(function(e) {
        e.preventDefault();
        var ele = $('div.add-tenant').clone();
        var id = ele.find('form#add-tenant').attr('id');
        id = id+'-1';
        ele.find('form#add-tenant').attr('id', id);
        ele.find('button.add-tenant-submit').click(function(e) {
            e.preventDefault();
            hidePopup();
            $.post('/add_tenant', $('#'+id).serialize(), function(data) {
                if (data.status=="success") {
                    logMsg("INFO", "Tenant '"+data.tenant+"' has been added successfully.");
                    refresh_tenant_list();
                }
                else {
                    logMsg("ERROR", "Failed to add new tenant '"+data.tenant+"'. "+data.message);
                }

            }, "json");
        });
        showPopup(ele, {height:450, closebox:0});
    });

    $('.run-button').click(function(e) {
        e.preventDefault();
        if (($('.select-fiddle').val() == '0') ||
            ($('.select-tenant').val() == '0')) {
            logMsg("ERROR", "Please select fiddle and tenant before running.");
            return;
        }
        var fiddle = $('.select-fiddle').val();
        var tenant = $('.select-tenant').val();
        initFiddle({fiddle:fiddle, tenant:tenant});
    });


    $('.clear-button').click(function() {
        $('textarea[name=code]').val('');
    });

    $('.close-button').click(function() {
        $('.code-box, .go-box').hide();
    });

    $('.save-button').click(function() {
        var ele = $('div.save').clone();
        ele.find('.popupsave').click(function() {
            var name = ele.find('input[name=name]').val();
            var content = $('textarea[name=code]').val();
            $.post("/save", {name:name, content:content}, function(resp) {
                if (resp.status == "success") {
                    ele.find('input').remove();
                    ele.find('.popupsave').remove();
                    ele.append("<p>Your test script has been saved as: '"+name+"'");
                    logMsg("INFO", "Test script saved as: '"+name+"'");
                }
            }, "json");
        })
        showPopup(ele);
    });

    $('.get-button').click(function() {
        var ele = $('div.get').clone();
        ele.find('.popupget').click(function() {
            var name = ele.find('input[name=name]').val();
            $.get("/get", {name:name}, function(resp) {
                if (resp.status == "success") {
                    if (resp.content_type && (resp.content_type == "array")) {
                        $('textarea[name=code]').val(JSON.stringify(resp.content));
                    }
                    else {
                        $('textarea[name=code]').val(resp.content);
                    }
                    ele.find('input').remove();
                    ele.find('.popupget').remove();
                    ele.append("<p>Your test script '"+name+"' has been fetched.");
                    logMsg("INFO", "Test script '"+name+"' loaded.");
                }
            }, "json");
        })
        showPopup(ele);
    });


    $('.clear-transcript').click(function() {
        $('#log').empty().append('<p align="left"></p>');
    });


    $("input[name=command]").keyup(function(e) {
        if (e.keyCode == 13) {
            logMsg("INFO", $(this).val());
        }
    });

    $(".recording:not(.roundbutton)").click(function() {
        var not_recording = !!$('.recording:not(.roundbutton)').text().match(/Start/);

        if (not_recording) {
            $('.recording.roundbutton').css('background-color','red');
            $('.recording:not(.roundbutton)').text("Stop Recording");
            in_recording_mode = true;
        }
        else {
            $('.recording.roundbutton').css('background-color','white');
            $('.recording:not(.roundbutton)').text("Start Recording");
            in_recording_mode = false;

        }
    });



    $('.pin-control').click(function() {
       if ($(this).hasClass('pinned')) {
            $(this).removeClass('pinned').addClass('unpinned');
            $(this).find('.pin').text('P');
       }
        else {
           $(this).removeClass('unpinned').addClass('pinned');
           $(this).find('.pin').text('U');
       }
    });

    $('.configure-tests').click(function(e)  {
        e.preventDefault();
    });

});

function refresh_tenant_list() {
    $.get('/get_tenants', function(data) {
        if (data.status == "fail") {
            logMsg("ERROR", data.message);
        }
        else {
            $('.select-tenant').empty();
            $('.select-tenant').append($('<option>', {value: "0",text: "Select Tenant" }));
            data.tenants.forEach(function(v) {
                $('.select-tenant').append($('<option>', {value: v,text: v }));
            });
        }
    }, "json");
}

function refresh_fiddles_list() {
    $.get('/get_fiddles', function(data) {
        if (data.status == "fail") {
            logMsg("ERROR", data.message);
        }
        else {
            $('.select-fiddle').empty();
            $('.select-fiddle').append($('<option>', {value: "0",text: "Select Fiddle" }));
            data.fiddles.forEach(function(v) {
                $('.select-fiddle').append($('<option>', {value: v,text: v }));
            });
        }
    }, "json");
}

function initFiddle(props) {

    var get_fiddle = function(cb) {
        $.get('/get_fiddle', {name:props.fiddle}, function(data) {
            if (data.status == "fail") {
                logMsg("ERROR", data.message);
                cb(null);
            }
            cb(data.fiddle);
        }, "json")
    };

    var init_tenant = function(cb) {
        $.get('/get_client_token', {tenant: props.tenant}, function (data) {
            if (data.status == "fail") {
                logMsg("ERROR", data.message);
                cb(false);
                return;
            }
            APP.SDK.init($,{
                domain: props.tenant,
                port: 443,
                client_token: data.client_token,
                https: true
            }, function() {
                logMsg("INFO", "sdk initialized successfully");
                cb(true);
            });
        }, "json");
    }

    init_tenant(function(success) {
        if (!success) {
            return;
        }
        get_fiddle(function(fiddle) {
            if (fiddle == null) {
               return;
            }
            //var script = fiddle.script ? "/fiddles/"+fiddle.script : null;
            var html   = fiddle.html ? "/fiddles/"+fiddle.html : null;
            //var css    = fiddle.css ? "/fiddles/"+fiddle.css : null;
            if (html != null) {
                $("div#fiddle-canvas").html('<iframe src="'+html+'"></iframe>');
                //$("div#fiddle-canvas").load(html);
                $("div#fiddle-canvas").removeClass("hidden");
                logMsg("INFO", "fiddle '"+fiddle.name+"' running in window to the right.");
            }
            /*if (css != null)
                $('<link>').attr('rel',"stylesheet").attr("href", css).appendTo('head');

            if (script != null)
                $('<script>').attr('src',script).appendTo('head');*/
        });
    });
}
/*
 *
 * console related logging methods
 *
 *
 */

function logMsg(type, str) {
    switch(type.toUpperCase()) {
        case "INFO":
            str = '[INFO] '+str+'<br>';
            break;
        case "RESULT":
            addEmptyLine();
            str = str +'<br>';
            break;
        case "ERROR":
            addEmptyLine();
            str = '<p align="left" style="color:red">'+'[ERROR] '+str+'</p><br>';
            addEmptyLine();
            break;
        case "START":
            addEmptyLine();
            str = '[INFO] '+str;
            break;
        case "CONTINUE":
            break;
        case "END":
            str = str +"<br>";
            break;
        default: break;
    }
    $("#log p:last-child").html($("#log p:last-child").html()+str);
    scroll();
}

function addEmptyLine() {
    $("#log").append('<p align="left"></p>');
}

function scroll(){
    var d = document.getElementById("log");
    d.scrollTop = d.scrollHeight;
}



function generalcb(e, r) {
    if (e == null) {
        logMsg("RESULT", JSON.stringify(r));
    }
    else {
        logMsg("ERROR", JSON.stringify(e));
    }
}

/*
 *
 * ajax busy cursor
 *
 *
 */


$(document).ajaxStart(function () {
    $('#busy').show();
});

$(document).ajaxStop(function () {
    $('#busy').hide();
});

/*
 *
 * popup related methods
 *
 *
 */


function hidePopup() {
    $.colorbox.close();
}

function showPopup(ele, opt) {
    if (!ele) {
        return;
    }

    ele.find('.xbutton').click(function(e) {
        e.preventDefault();
        $.colorbox.close();
    });

    var width = opt && opt.width ? opt.width : 500;
    var height = opt && opt.height ? opt.height : 200;
    var onClosed = opt && opt.onClosed ? opt.onClosed : function() {};

    var onload = function() {
        $('#cboxClose').remove();
    };

    var nullfn = function() {};

    onload = opt && (opt.closebox == 0) ? onload : nullfn;

    $.colorbox({
        html: ele,
        width: width,
        height: height,
        onLoad: onload
    });
}


function login(ver) {
    if ($.isEmptyObject(sdk[ver].sdk)) {
        logMsg('ERROR', 'Initialization attempted for unknown version!');
        return;
    }
    if (!sdk[ver].sdk.APP.SDK.initialized) {
        $.post("/login", {'version':ver}, function (data, status) {
            if (data) {
                if (data.access_token) {
                        sdk[ver].sdk.APP.SDK.init($, {
                            domain: sdk[ver]['domain'],
                            port: 443,
                            https: true,
                            client_token: data.access_token,
                            version2: ver == 'v2' ? true : false
                        },
                        function () {
                            current_version = ver;
                            logMsg("INFO", "Version '"+ver+"' initialized!");
                        });
                }
                else {
                    logMsg("ERROR", "Initializaton of version '"+ver+"' failed: "+data.message);
                }
            }
        }, "json")
            .fail(function (jqXHR, status, error) {
                alert("Initialization of version '"+ver+"' failed! "+error);
            });
    }
    else {
        current_version = ver;
    }
}

function reloadSDK()
{
    $('script[src$="sdk.js"]').remove();
    $('head').append('<script src="js/sdk.js""></script>');
}

