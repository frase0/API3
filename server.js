var express = require('express');
var stream = require('stream');
var http = require('http');
var fs   = require('fs');
var session = require('client-sessions');
const Writable = require('web-audio-stream/writable');
const context = require('audio-context');

var app = express();
var server_port = process.env.PORT || 3000;
//var server_ip = process.env.app_host || "127.0.0.1";
var bodyParser = require('body-parser');

var tools = require('./lib/tools');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());




/*ROUTER*/
var dwRouter = express.Router();

tools.init(function(result){
		//console.log("token " + res);
});

dwRouter.get('/:id', function(req, res) {
	var id = req.params.id;
	//res.send('ciaooo ' + id);





		tools.getTrack(id,function(track){
			/*return "url: " + tools.downloadUrl + " ciao";*/
			//var json = {"url" : result}
			//res.json(track);

			tools.decryptTrack(track, function(result){
				/*res.write(result,'binary');
	    		res.end(null, 'binary');*/
	    		var readStream = new stream.PassThrough();
				readStream.end(result);

				res.set('Content-disposition', 'attachment; filename=' + id + ".mp3");
				res.set('Content-Type', 'audio/mpeg');

				readStream.pipe(res);
			});
		});



});

//TODO Multiple request
dwRouter.get('/dev/:id', function(req, res, next) {
	var id = req.params.id;

	//console.log("cookie " + req.headers.cookie);

	//console.log(req.get("Range"));

	console.log("RANGE " + req.get("Range"));
	if(req.get("Range") == undefined){

		tools.getTrack(id,function(track){
			/*return "url: " + tools.downloadUrl + " ciao";*/
			//var json = {"url" : result}
			//res.json(track);
			if (track == null) {
				return;
			}
			res.clearCookie("SNG_ID");
			res.clearCookie("DW_URL");
			res.clearCookie("FORMAT");
			res.clearCookie("FILESIZE");

			res.cookie('SNG_ID', track.SNG_ID, { maxAge: 900000, httpOnly: true });
			res.cookie('DW_URL', track.DW_URL, { maxAge: 900000, httpOnly: true });
			res.cookie('FORMAT', track.FORMAT, { maxAge: 900000, httpOnly: true });
			res.cookie('FILESIZE', track.FILESIZE, { maxAge: 900000, httpOnly: true });
			//console.log("Track: " + sess.track);
			var position = 0;
			if(req.get("Range") != undefined){
				position = req.get("Range");
				position = position.split("=")[1].split("-")[0];
				//console.log("another request " + position);
				position = parseInt(position);
			}

			tools.decryptTrackDev(track, position, function(chunk, ini, end, songSize){

					const head = {
										'Content-Range': 'bytes ' + ini + '-' + (end - 1) + '/' + songSize,
										'Content-Length': end - ini,
										'Accept-Ranges': 'bytes',
										'Transfer-Encoding': 'chunked',
										'Content-Type': 'audio/mpeg',
										'Cache-Control': 'no-cache'
									}

					res.writeHead(206, head);
					//console.log("first response "+ ini + '-' + (end - 1) + '/' + songSize + ", " + chunk.length);
					res.end(chunk);
					res.destroy();

					/*var readStream = new stream.PassThrough();
					readStream.end(chunk);

					res.set('Content-disposition', 'attachment; filename=' + id + ".mp3");
					res.set('Content-Type', 'audio/mpeg');

					readStream.pipe(res);*/

			});
		});
	}else{

		//TODO After first request get track and decript range
		var position = req.get("Range");
		position = position.split("=")[1].split("-")[0];
		//console.log("\n\n\nanother request " + position);
		var track = {};
		req.headers.cookie.split(/\s*;\s*/).forEach(function(pair) {
		  pair = pair.split(/\s*=\s*/);
		  track[pair[0]] = pair.splice(1).join('=');
		});

		tools.decryptTrackDev(track, parseInt(position, 10), function(chunk, ini, end, songSize){

					//console.log("response " + ini + '-' + (end - 1) + '/' + songSize + ", " + chunk.length);

					const head = {
										'Content-Range': 'bytes ' + ini + '-' + (end - 1) + '/' + songSize,
										'Content-Length': end - ini,
										'Accept-Ranges': 'bytes',
										'Transfer-Encoding': 'chunked',
										'Content-Type': 'audio/mpeg',
										'Cache-Control': 'no-cache'
									}


					res.writeHead(206, head);

					res.end(chunk);

					res.destroy();


			});
	}

});

// Attach the routers for their respective paths
app.use('/downloadTrack', dwRouter);


//uncaughtException
process.on('uncaughtException', function(err) {
 	console.log('Caught exception: ' + err);
	console.trace(err);
});



app.listen(server_port, function(){
	console.log('API running on port' + server_port);
});
