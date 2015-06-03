'use strict';
if(typeof Router !== 'undefined'){
    var fs = Npm.require('fs');
    Router.map(function () {
        var e404 = function(){
            this.response.writeHead(302, {
                'Location': '/e404'
            }, '404');
            this.response.end('/e404');
        };
        this.route('universe.getRecord', {
            where: 'server',
            path: '/audiorecords/get/:instanceName/:_id/:token',
            action: function () {
                var instanceName = this.params.instanceName;
                var recId = this.params._id;
                var token = this.params.token;
                var isDownloads = !!this.params.downloads;
                if(!instanceName || !recId|| !UniRecorder._collections[instanceName]){
                    return e404.call(this);
                }
                var uniRec = UniRecorder._collections[instanceName];
                var recDoc = uniRec.findOne({_id: recId, status: 0});

                if(uniRec.canDownload(token, recDoc)){
                    var path = UniRecorder.getStorageFullPath(uniRec._targetStorage, instanceName, recId+'.'+recDoc.extName);
                    var size = recDoc.size;
                    if(!_.isNumber(size)){
                        //try get size if is missing
                        var stat = fs.statSync(path);
                        size =  stat && stat.size || 0;
                    }
                    //access granted
                    var name = recDoc.getName();
                    var headers = {
                        'Content-Type': 'audio/'+recDoc.extName,
                        'Content-Transfer-Encoding': 'binary',
                        'Content-Length': size,
                        'Cache-Control': 'public'
                    };
                    if(isDownloads){
                        headers['Content-Disposition'] = 'attachment; filename="'+name+'.'+recDoc.extName+'"';
                    }
                    this.response.writeHead(200, headers, name);
                    var readStream = fs.createReadStream(path);
                    return readStream.pipe(this.response);
                } else {
                    //no access
                    if(!recDoc || !recToken || recToken !== token){
                        this.response.writeHead(403, '403');
                        this.response.end('Permission denied');
                    }
                }
            }
        });
    });

}
