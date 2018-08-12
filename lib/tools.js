const NRrequest = require('request');
const request = require('requestretry').defaults({maxAttempts: 2147483647, retryDelay: 1000, timeout: 8000});
const crypto = require('crypto');
const ID3Writer = require('./browser-id3-writer');
const fork = require('child_process');


module.exports = new Tools();

var accounts = [{
					"username": "onesomeone@yandex.com",
					"password": "onepassword"
				},
				{
					"username": "buffiloffi@yandex.com",
					"password": "onepassword"
				},
				{
					"username": "lotomomoto@yandex.com",
					"password": "onepassword"
				},
				{
					"username": "abdulabi@yandex.com",
					"password": "onepassword"
				},
				{
					"username": "roachmama@yandex.com",
					"password": "onepassword"
				},
				{
					"username": "capacollo@yandex.com",
					"password": "onepassword"
				}];


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


Tools.prototype.init = function(callback) {
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

	var username = accounts[Math.floor(Math.random() * 5) + 0].username;
	var password = accounts[Math.floor(Math.random() * 5) + 0].password;

	var self = this;
	NRrequest.get({url: self.apiUrl, headers: self.httpHeaders, qs: Object.assign({method:"deezer.getUserData"}, self.apiQueries), json: true, jar: true}, (function(err, res, body) {
			if(!err && res.statusCode == 200) {
				self.apiQueries.api_token = body.results.checkForm;
				NRrequest.post({url: "https://www.deezer.com/ajax/action.php", headers: this.httpHeaders, form: {type:'login',mail:username,password:password,checkFormLogin:body.results.checkFormLogin}, jar: true}, (function(err, res, body) {
					if(err || res.statusCode != 200) {
						callback(new Error("Unable to load deezer.com"));
					}else if(body.indexOf("success") > -1){
						callback("logged");
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
			strictSSL: false,
			qs: {
				api_version: "1.0",
				input: "3",
				api_token: data,
				method: "song.getData"//"deezer.pageTrack"
			},
			body: {sng_id:scopedid},
			jar: true,
			json: true
		}, (function (err, res, body) {
			if(!err && res.statusCode == 200 && typeof body.results != 'undefined'){
				var json = body.results; //DATA
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
						fileSize = json["FILESIZE_FLAC"];
						if (json["FILESIZE_FLAC"]>0)break;
					case "3":
						format = 3;
						fileSize = json["FILESIZE_MP3_320"];
						if (json["FILESIZE_MP3_320"]>0)break;
					case "5":
						format = 5;
						fileSize = json["FILESIZE_MP3_256"];
						if (json["FILESIZE_MP3_256"]>0)break;
					case "1":
						format = 1;
						fileSize = json["FILESIZE_MP3_128"];
						if (json["FILESIZE_MP3_128"]>0)break;
					case "8":
						format = 8;
						//fileSize = track["FILESIZE_MP3_128"];
				}
				//console.log("size: " + json["FILESIZE_FLAC"] + "\n" + json["FILESIZE_MP3_320"] + "\n" + json["FILESIZE_MP3_256"] + "\n" + json["FILESIZE_MP3_128"] + "\n");
				//console.log("format " + format);
				json.FORMAT = format;
				json.FILESIZE = fileSize;
				var mediaVersion = parseInt(json["MEDIA_VERSION"]);
				json.DW_URL = self.getDownloadUrl(md5Origin, id, format, mediaVersion);

				//console.log("URL_DOWNLOAD: " + json.downloadUrl);

				self.albumPictures = self.albumPicturesHost + json["ALB_PICTURE"] + "/500x500.jpg";
				//console.log("LINK COVER: " + self.albumPictures);
				//console.log("callback JSON " + json);
				callback(json);
			} else {
				console.log("Unable to get Track");
				this.init(function(result){
					if (!(result instanceof Error)) {
						console.log("logged");
						this.getTrack(id, function(track){
								callback(track);
						});
					}else {
						console.log("error login");
					}

				});
			}
		}).bind(self));
	})
}

Tools.prototype.getToken = async function(){
	const res = await request.get({
		url: this.apiUrl,
		headers: this.httpHeaders,
		strictSSL: false,
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
	self.reqStream = request.get({url: unescape(track["DW_URL"]), headers: self.httpHeaders, encoding: 'binary'}, function(err, res, body) {
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



Tools.prototype.decryptTrackDev = function(track, position, callback) {
	var self = this;
	var fileSize = parseInt(track["FILESIZE"], 10);
	var format = track["FORMAT"];
	var dataPos = 0;
	var dwBuffer;

	dwBuffer = new Buffer(10240);
	dwBuffer.fill(0);


	//console.log("size: " + track["FILESIZE_FLAC"] + "\n" + track["FILESIZE_MP3_320"] + "\n" + track["FILESIZE_MP3_256"] + "\n" + track["FILESIZE_MP3_128"] + "\n");
	//console.log(format + " filesize: " + fileSize);




	//console.log("bufferlength: " + dwBuffer.length);

	self.httpHeaders['Range'] = 'bytes=' + position + '-' + (position + 10240 - 1);
	self.reqStream = request.get({url: unescape(track["DW_URL"]), headers: self.httpHeaders, encoding: 'binary'}, function(err, res, body) {
			if(!err && res.statusCode == 206) {

						//console.log("end " + JSON.stringify(res.headers));
						decryptAlgoritm(track, position, dwBuffer, function(bigChunk, ini, end, size){
							callback(bigChunk, ini, end, size); //chunk, ini, end, size
						});

			} else {
				console.log("Decryption error"+(err ? " | "+err : "")+ (res ? ": "+res.statusCode : ""));
				//console.log("Decryption error " + body);
			}
		}).on("data", function(data) {

			dataPos = dataPos + data.length;

			//console.log("dataPos " + dataPos);



			dwBuffer.write(data, 0, 'binary');




			//self.onDownloadProgress(track, chunkLength);
		}).on("request", function() {

		}).on("abort", function() {
			console.log("Decryption aborted");
		});
}

function decryptAlgoritm(track, pos, dwBuffer, callback){
	var blowFishKey = getBlowfishKey(track["SNG_ID"]);
	var destBuffer;
	var position = 0;
	var startPosition = position;
	var startPos = pos;

	destBuffer = new Buffer(10240);
	destBuffer.fill(0);

	while (/*position < dataPos &&*/ (position - startPosition) < 10240) {

			try{


				var chunk_size = 2048;

				if ((dwBuffer.length - position) >= 2048) {
					chunk_size = 2048;
				} else {
					chunk_size = dwBuffer.length - position;
				}

				if(dwBuffer.length - position >= chunk_size){

					var chunk = new Buffer(chunk_size);
					chunk.fill(0);
					dwBuffer.copy(chunk, 0, position, position + chunk_size);
					if (pos /*chunkIndex*/ % 3 > 0 || chunk_size < 2048) {
						//Do nothing
					} else {
						var cipher = crypto.createDecipheriv('bf-cbc', blowFishKey, new Buffer([0, 1, 2, 3, 4, 5, 6, 7]));
						cipher.setAutoPadding(false);
						chunk = cipher.update(chunk, 'binary', 'binary') + cipher.final();
						//console.log("chunk decrypted");
					}
					destBuffer.write(chunk.toString("binary"), position, 'binary');
					position += chunk_size;
					pos += chunk_size;
					//console.log("chunk decrypted");
				}


			}catch(err){
				console.trace(err);
			}
		}

		//console.log("send bigChunk, destBuffer " + destBuffer.length);

		var bigChunkSize = 10240;
		var bigChunk = new Buffer(bigChunkSize);
		bigChunk.fill(0);
		destBuffer.copy(bigChunk, 0, 0 /*startPosition*/, bigChunk.length); //non so -1
		//console.log(startPosition + ", " + position + " bigChunkSize " + bigChunk.length);
		callback(bigChunk, startPos, startPos + bigChunk.length, fileSize);


	//setTimeout(decriptAlgoritm, 50);
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
