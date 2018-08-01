const NRrequest = require('request');
const request = require('requestretry').defaults({maxAttempts: 2147483647, retryDelay: 1000, timeout: 8000});
const crypto = require('crypto');
const ID3Writer = require('./browser-id3-writer');


module.exports = new Tools();


function Tools (){
	this.apiUrl = "http://www.deezer.com/ajax/gw-light.php";
	this.apiQueries = {
		api_version: "1.0",
		api_token: "null",
		input: "3"
	};
	this.httpHeaders = {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36",
		"Content-Language": "en-US",
		"Cache-Control": "max-age=0",
		"Accept": "*/*",
		"Accept-Charset": "utf-8,ISO-8859-1;q=0.7,*;q=0.3",
		"Accept-Language": "en-US,en;q=0.9,en-US;q=0.8,en;q=0.7"
	}
	this.albumPicturesHost = "https://e-cdns-images.dzcdn.net/images/cover/"
	this.reqStream = null;
	this.albumPictures = "";
}


Tools.prototype.init = function(username, password, callback) {
	/*var self = this;
	NRrequest.get({url: "https://www.deezer.com/", headers: this.httpHeaders, jar: true}, (function(err, res, body) {
		if(!err && res.statusCode == 200) {
			var regex = new RegExp(/<input id=[\"|']checkForm[\"|'] name=[\"|']checkForm[\"|'] type=[\"|']hidden[\"|'] value=[\"|'](.*)[\"|']>/g);
			var _token = regex.exec(body);
			if(_token instanceof Array && _token[1]) {
				self.apiQueries.api_token = _token[1];
				NRrequest.post({url: "https://www.deezer.com/ajax/action.php", headers: this.httpHeaders, form: {type:'login',mail:username,password:password}, jar: true}, (function(err, res, body) {
					if(err || res.statusCode != 200) {
						console.log("Unable to load deezer.com");
					}else if(body.indexOf("success") > -1){
						self.apiQueries.api_token = _token[1];
						console.log("TOKEN: " + self.apiQueries.api_token);
						callback(null,null);
					}else{
						console.log("Incorrect email or password.");
					}
				}));
			} else {
				console.log("Unable to initialize Deezer API");
			}
		} else {
			console.log("Unable to load deezer.com");
		}
	}).bind(self));*/



	var self = this;
	NRrequest.get({url: self.apiUrl, headers: self.httpHeaders, qs: Object.assign({method:"deezer.getUserData"}, self.apiQueries), json: true, jar: true}, (function(err, res, body) {
		if(!err && res.statusCode == 200) {
			self.apiQueries.api_token = body.results.checkForm;
			NRrequest.post({url: "https://www.deezer.com/ajax/action.php", headers: this.httpHeaders, form: {type:'login',mail:username,password:password,checkFormLogin:body.results.checkFormLogin}, jar: true}, (function(err, res, body) {
				if(err || res.statusCode != 200) {
					callback(new Error("Unable to load deezer.com"));
				}else if(body.indexOf("success") > -1){
					callback(null,null);
				}else{
					callback(new Error("Incorrect email or password."));
				}
			}));
		} else {
			callback(new Error("Unable to load deezer.com"));
		}
	}).bind(self));
}


Tools.prototype.getATrack = function(id, callback) {
	getJSON("https://api.deezer.com/track/" + id, function(res){
		if (!(res instanceof Error)){
			callback(res);
		} else {
			callback("Error")
		}
	});
}


/*GET TRACK LINK*/
Tools.prototype.getTrack = function(id, callback) {
var scopedid = id;
	var self = this;
	self.getToken().then(data=>{
		request.post({
			url: self.apiUrl,
			headers: self.httpHeaders,
			qs: {
				api_version: "1.0",
				input: "3",
				api_token: data,
				method: "deezer.pageTrack"
			},
			body: {sng_id:scopedid},
			jar: true,
			json: true
		}, (function (err, res, body) {
			if(!err && res.statusCode == 200 && typeof body.results != 'undefined'){
				var json = body.results.DATA;
				/*if (body.results.LYRICS){
					json.LYRICS_SYNC_JSON = body.results.LYRICS.LYRICS_SYNC_JSON;
					json.LYRICS_TEXT = body.results.LYRICS.LYRICS_TEXT;
				}*/
				if(json["TOKEN"]) {
					callback(null, new Error("Uploaded Files are currently not supported"));
					return;
				}
				var id = json["SNG_ID"];
				var md5Origin = json["MD5_ORIGIN"];
				var format;
				switch("5"){
					case "9":
						format = 9;
						if (json["FILESIZE_FLAC"]>0) break;
					case "3":
						format = 3;
						if (json["FILESIZE_MP3_320"]>0) break;
					case "5":
						format = 5;
						if (json["FILESIZE_MP3_256"]>0) break;
					case "1":
						format = 1;
						if (json["FILESIZE_MP3_128"]>0) break;
					case "8":
						format = 8;
				}
				json.format = format;
				var mediaVersion = parseInt(json["MEDIA_VERSION"]);
				json.downloadUrl = self.getDownloadUrl(md5Origin, id, format, mediaVersion);

				console.log("URL_DOWNLOAD: " + json.downloadUrl);
							
				self.albumPictures = self.albumPicturesHost + json["ALB_PICTURE"] + "/500x500.jpg";
				console.log("LINK COVER: " + self.albumPictures);

				callback(json);
			} else {
				callback(null, new Error("Unable to get Track " + id));
			}
		}).bind(self));
	})
}

Tools.prototype.getToken = async function(){
	const res = await request.get({
		url: this.apiUrl,
		headers: this.httpHeaders,
		qs: {
			api_version: "1.0",
			api_token: "null",
			input: "3",
			method: 'deezer.getUserData'
		},
		json: true,
		jar: true,
	})
	return res.body.results.checkForm;
}

Tools.prototype.getDownloadUrl = function(md5Origin, id, format, mediaVersion) {

	var urlPart = md5Origin + "¤" + format + "¤" + id + "¤" + mediaVersion;
	var md5sum = crypto.createHash('md5');
	md5sum.update(new Buffer(urlPart, 'binary'));
	md5val = md5sum.digest('hex');
	urlPart = md5val + "¤" + urlPart + "¤";
	var cipher = crypto.createCipheriv("aes-128-ecb", new Buffer("jo6aey6haid2Teih"), new Buffer(""));
	var buffer = Buffer.concat([cipher.update(urlPart, 'binary'), cipher.final()]);
	
	var proxy = "";
	if(md5Origin != null){

	 proxy = md5Origin.substring(0, 1);
	}else{
		proxy = "1";

		console.log("fake proxy");
	}

	return "https://e-cdns-proxy-" + proxy + ".dzcdn.net/mobile/1/" + buffer.toString("hex").toLowerCase();
}


/*DECRIPT*/
Tools.prototype.decryptTrack = function(track, callback) {
	var self = this;
	var chunkLength = 0;
	self.reqStream = request.get({url: track.downloadUrl, headers: self.httpHeaders, encoding: 'binary'}, function(err, res, body) {
			if(!err && res.statusCode == 200) {
				
				var decryptedSource = decryptDownload(new Buffer(body, 'binary'), track);
				//SET ARTWORK
				request.get(self.albumPictures, {encoding: 'binary'}, function(error,response,body){
							if(error){
								console.log('Error ' + error.stack);
							}
							const writer = new ID3Writer(decryptedSource);
							const image = new Buffer (body, 'binary');
							artists = [track["ART_NAME"]]; //deve essere un array di stringhe anche se è solo uno

							writer.setFrame('APIC', {
									type: 3,
									data: image,
									description: 'front cover'
								}).setFrame('TIT2', track["SNG_TITLE"])//title
								.setFrame('TPE1', artists)//artist
								.setFrame('TALB', track["ALB_TITLE"])//album
								.setFrame('TYER', track["DIGITAL_RELEASE_DATE"])//anno
								.setFrame('TRCK', track["TRACK_NUMBER"]);
								//.setFrame('TBPM', track["BPM"]) bpm

							if(track["LYRICS_TEXT"] != null){ //per il lyrics bisogna controllare se c'è
								writer.setFrame('USLT', {
									lyrics: track["LYRICS_TEXT"],
									description: 'lyrcs unsynch'
								});
							}

							writer.addTag();
							//ALTRI TAG: https://github.com/aadsm/JavaScript-ID3-Reader

							const taggedSongBuffer = Buffer.from(writer.arrayBuffer);

							callback(taggedSongBuffer);
							
						});
				
			} else {
				console.log("Decryption error"+(err ? " | "+err : "")+ (res ? ": "+res.statusCode : ""));
			}
		}).on("data", function(data) {
			chunkLength += data.length;
			//self.onDownloadProgress(track, chunkLength);
		}).on("abort", function() {
			console.log("Decryption aborted");
		});
}

Tools.prototype.decryptTrackDev = function(track, callback) {
	var self = this;
	var chunkLength = 0;
	var chunkIndex = 0;
	var position = 0;
	var blowFishKey = getBlowfishKey(track["SNG_ID"]);

	var dwBuffer = new Buffer(99999999);
	var destBuffer = new Buffer(99999999);



	self.reqStream = request.get({url: track.downloadUrl, headers: self.httpHeaders, encoding: 'binary'}, function(err, res, body) {
			if(!err && res.statusCode == 200) {
				
				//var decryptedSource = decryptDownload(new Buffer(body, 'binary'), track);

				//SET ID
				/*request.get(self.albumPictures, {encoding: 'binary'}, function(error,response,body){
							if(error){
								console.log('Error ' + error.stack);
							}
							const writer = new ID3Writer(decryptedSource);
							const image = new Buffer (body, 'binary');
							artists = [track["ART_NAME"]]; //deve essere un array di stringhe anche se è solo uno

							writer.setFrame('APIC', {
									type: 3,
									data: image,
									description: 'front cover'
								}).setFrame('TIT2', track["SNG_TITLE"])//title
								.setFrame('TPE1', artists)//artist
								.setFrame('TALB', track["ALB_TITLE"])//album
								.setFrame('TYER', track["DIGITAL_RELEASE_DATE"])//anno
								.setFrame('TRCK', track["TRACK_NUMBER"]);
								//.setFrame('TBPM', track["BPM"]) bpm

							if(track["LYRICS_TEXT"] != null){ //per il lyrics bisogna controllare se c'è
								writer.setFrame('USLT', {
									lyrics: track["LYRICS_TEXT"],
									description: 'lyrcs unsynch'
								});
							}

							writer.addTag();
							//ALTRI TAG: https://github.com/aadsm/JavaScript-ID3-Reader

							const taggedSongBuffer = Buffer.from(writer.arrayBuffer);

							callback(taggedSongBuffer);
							
						});*/
				
			} else {
				console.log("Decryption error"+(err ? " | "+err : "")+ (res ? ": "+res.statusCode : ""));
			}
		}).on("data", function(data) {
			
			try{
				console.log("data");
				chunkLength += data.length;
				dwBuffer = Buffer.concat([dwBuffer, new Buffer(data, 'binary')]);
				//var source = new Buffer(data, 'binary');
				var chunk_size = 2048;

				if(dwBuffer.length - position >= chunk_size){
					if (chunkIndex == 2) {

						chunk = new Buffer(chunk_size);
						console.log("decript");
						chunk.fill(0);
						dwBuffer.copy(chunk, 0, position, position + chunk_size);
						var cipher = crypto.createDecipheriv('bf-cbc', blowFishKey, new Buffer([0, 1, 2, 3, 4, 5, 6, 7]));
						cipher.setAutoPadding(false);
						chunk = cipher.update(chunk, 'binary', 'binary') + cipher.final();
						
						destBuffer.write(chunk.toString("binary"), position, 'binary');


						position = position + chunk_size;

						chunkIndex = 0;

					} else {
						chunk = new Buffer(chunk_size);
						chunk.fill(0);
						dwBuffer.copy(chunk, 0, position, position + chunk_size);

						destBuffer.write(chunk.toString("binary"), position, 'binary');


						position = position + chunk_size;
						chunkIndex++;
					}
				}

				callback(destBuffer);				
			
			}catch(err){
				console.trace(err);
			}
			
			
			//self.onDownloadProgress(track, chunkLength);
		}).on("abort", function() {
			console.log("Decryption aborted");
		});
}


function decryptDownload(source, track) {
	//console.log("decryptDownload");
	var chunk_size = 2048;
	var part_size = 0x1800;
	var blowFishKey = getBlowfishKey(track["SNG_ID"]);
	var i = 0;
	var position = 0;

	var destBuffer = new Buffer(source.length);
	destBuffer.fill(0);

	while(position < source.length) {
		var chunk;
		if ((source.length - position) >= 2048) {
			chunk_size = 2048;
		} else {
			chunk_size = source.length - position;
		}
		chunk = new Buffer(chunk_size);
		chunk.fill(0);
		source.copy(chunk, 0, position, position + chunk_size);
		if(i % 3 > 0 || chunk_size < 2048){
			//Do nothing
		}else{
			var cipher = crypto.createDecipheriv('bf-cbc', blowFishKey, new Buffer([0, 1, 2, 3, 4, 5, 6, 7]));
			cipher.setAutoPadding(false);
			chunk = cipher.update(chunk, 'binary', 'binary') + cipher.final();
		}
		destBuffer.write(chunk.toString("binary"), position, 'binary');
		position += chunk_size
		i++;
	}
	//console.log("decryptDownload end");
	return destBuffer;
}


function getBlowfishKey(trackInfos) {
	const SECRET = 'g4el58wc0zvf9na1';

	const idMd5 = crypto.createHash('md5').update(trackInfos.toString(), 'ascii').digest('hex');
	var bfKey = '';

	for (var i = 0; i < 16; i++) {
		bfKey += String.fromCharCode(idMd5.charCodeAt(i) ^ idMd5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i));
	}

	return bfKey;
}



function getJSON(url, callback){
	request.get({url: url, headers: this.httpHeaders, jar: true}, function(err, res, body) {
		if(err || res.statusCode != 200 || !body) {
			logs("Error","Unable to initialize Deezer API");
			callback(new Error());
		} else {
			var json = JSON.parse(body);
			if (json.error) {
				logs("Error","Wrong id");
				callback(new Error());
				return;
			}
			callback(json);
		}
	});
}

function logs(level, message, callback){
	var str = "["+level+"]"+message;
	console.log(str);
	return;
}