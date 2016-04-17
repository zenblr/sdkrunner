console.log = (function() {
    var log = console.log;
    return function() {
        var str = "";
        for (var i=0; i<arguments.length; i++) {
            if (typeof(arguments[i]) != "string")
                str += JSON.stringify(arguments[i]) + " ";
            else
                str += arguments[i] + " ";
        }
        window.parent.postMessage(str, "*");
    }
})();