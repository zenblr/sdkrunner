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
    $('a.add-fiddle').click(function(e) {
        e.preventDefault();
        var ele = $('div.add-fiddle').clone();
        var id = ele.find('form#add-fiddle').attr('id');
        id = id+'-1';
        ele.find('form#add-fiddle').attr('id', id);
        ele.find('button.add-fiddle-submit').click(function(e) {
            e.preventDefault();
            var form_data = new FormData();
            var fiddle = $("#"+id+" input[name=name]").val();
            form_data.append("name", fiddle);
            var f = $("#"+id+" input[name=fiddle_files]")[0].files[0];
            if (typeof(f) != "undefined") {
                form_data.append("fiddle_files", f);
            }
            f = $("#"+id+" input[name=fiddle_files]")[1].files[0];
            if (typeof(f) != "undefined") {
                form_data.append("fiddle_files", f);
            }
            f = $("#"+id+" input[name=fiddle_files]")[2].files[0];
            if (typeof(f) != "undefined") {
                form_data.append("fiddle_files", f);
            }
            var duplicate_fiddle = false;
            for (var i=1; i<$('.select-fiddle option').length; i++) {
                if ($('.select-fiddle option:eq(' + i + ')').val() == fiddle) {
                    duplicate_fiddle = true;
                    break;
                }
            }

            if (duplicate_fiddle) {
                ele.find('.show-message p').append(
                    "A fiddle by name '" + fiddle + "' already exists. <br>" +
                    "Uploading will cause existing fiddle to be overwritten. <br>" +
                    "Continue?");
                ele.find('form#'+id).hide();
                ele.find('.show-message').show();
                ele.find('button.show-message-ok').click(function(e) {
                    hidePopup();
                    submit_fiddle(form_data, fiddle);
                });
            }
            else {
                hidePopup();
                submit_fiddle(form_data, fiddle);
            }
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
        if ((typeof(mode) !== "undefined") && (mode == 'csv_upload'))
            fiddle = 'csv_upload';
        var domain = $('.select-tenant').val();
        var ele = $('div.run-tenant').clone();
        var id = ele.find('form#run-tenant').attr('id');
        id = id+'-1';
        ele.find('form#run-tenant').attr('id', id);
        ele.find('button.run-tenant-submit').click(function(e) {
            e.preventDefault();
            var username = $('form#'+id+' input[name=username]').val();
            var password = $('form#'+id+' input[name=password]').val();
            hidePopup();
            initFiddle({fiddle:fiddle, domain:domain, username:username, password:password});
        });
        showPopup(ele, {height:300, closebox:0});
    });


    $('.clear-transcript').click(function() {
        $('#log').empty().append('<p align="left"></p>');
    });


});

function submit_fiddle(form_data, fiddle) {
    $.ajax({
        url: '/add_fiddle',
        type: 'POST',
        processData: false,
        contentType: false,
        dataType: 'json',
        data: form_data,
        error: function(xhr, status) {
            logMsg("ERROR", "Failed to submit new fiddle '"+fiddle+"'. (ajax error)");
        },
        success: function(data) {
            if (data.status=="success") {
                logMsg("INFO", "Fiddle '"+data.fiddle+"' has been added successfully.");
                refresh_fiddles_list();
            }
            else {
                logMsg("ERROR", "Failed to add new fiddle '"+data.fiddle+"'. "+data.message);
            }
        }
    });
}

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
        $.get('/get_access_token', {domain: props.domain,
                                    username:props.username,
                                    password:props.password}, function (data) {
            if (data.status == "fail") {
                logMsg("ERROR", data.message);
                cb(false);
                return;
            }
            APP.SDK.init($,{
                domain: props.domain,
                port: 443,
                client_token: data.access_token,
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
            var html   = fiddle.html ? "/fiddles/"+fiddle.name+"/"+fiddle.html : null;
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

function logConsole(event) {
    var str = event.data + "<br>";
    $("#log p:last-child").html($("#log p:last-child").html()+str);
    scroll();
}

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
        onLoad: onload,
        onClosed:onClosed
    });
}



window.addEventListener("message", logConsole, false);