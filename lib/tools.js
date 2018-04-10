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
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.75 Safari/537.36",
		"Content-Language": "en-US",
		"Cache-Control": "max-age=0",
		"Accept": "*/*",
		"Accept-Charset": "utf-8,ISO-8859-1;q=0.7,*;q=0.3",
		"Accept-Language": "de-DE,de;q=0.8,en-US;q=0.6,en;q=0.4"
	}
	this.albumPicturesHost = "https://e-cdns-images.dzcdn.net/images/cover/"
	this.reqStream = null;
	this.albumPictures = "";
}


Tools.prototype.init = function(username, password, callback) {
	var self = this;
	NRrequest.post({url: "https://www.deezer.com/ajax/action.php", headers: this.httpHeaders, form: {type:'login',mail:username,password:password}, jar: true}, (function(err, res, body) {
		if(err || res.statusCode != 200) {
			callback(new Error("Unable to load deezer.com"));
		}else if(body.indexOf("success") > -1){
			request.get({url: "https://www.deezer.com/", headers: this.httpHeaders, jar: true}, (function(err, res, body) {
				if(!err && res.statusCode == 200) {
					var regex = new RegExp(/checkForm\s*=\s*[\"|'](.*)[\"|']/g);
					var _token = regex.exec(body);
					if(_token instanceof Array && _token[1]) {
						self.apiQueries.api_token = _token[1];
						console.log("TOKEN: " + self.apiQueries.api_token);
						callback(null, null);
					} else {
						callback("Unable to initialize Deezer API");
					}
				} else {
					callback("Unable to load deezer.com");
				}
			}).bind(self));
		}else{
			callback("Incorrect email or password.");
		}
	}));
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

	

	request.get({url: "https://www.deezer.com/track/"+id, headers: this.httpHeaders, jar: true}, (function(err, res, body) {
		var regex = new RegExp(/<script>window\.__DZR_APP_STATE__ = (.*)<\/script>/g);
		var rexec = regex.exec(body);
		var _data;
		
		if(self.apiQueries.api_token != "null"){
			request.post({url: self.apiUrl, headers: self.httpHeaders, qs: self.apiQueries, body: "[{\"method\":\"song.getListData\",\"params\":{\"sng_ids\":[" + scopedid + "]}}]", jar: true}, (function(err, res, body) {
				if(!err && res.statusCode == 200) {
					try{
						var json = JSON.parse(body)[0].results.data[0];
						if(json["TOKEN"]) {
							callback(new Error("Uploaded Files are currently not supported"));
							return;
						}
						var id = json["SNG_ID"];
						var md5Origin = json["MD5_ORIGIN"];
						var format;

						//FOR FLAC
						/*if(json["FILESIZE_FLAC"] > 0){
							format = 9;
						}else*/
							/*format = 3;
							//MAX 256
							if(json["FILESIZE_MP3_320"] <= 0) {*/
								if(json["FILESIZE_MP3_256"] > 0) {
									format = 5;
								} else {
									format = 1;
								}
							/*}
						}*/
						json.format = format;
						var mediaVersion = parseInt(json["MEDIA_VERSION"]);
						json.downloadUrl = self.getDownloadUrl(md5Origin, id, format, mediaVersion);
						
						console.log("URL_DOWNLOAD: " + json.downloadUrl);

						self.albumPictures = self.albumPicturesHost + json["ALB_PICTURE"] + "/500x500.jpg";
						console.log("LINK COVER: " + self.albumPictures);

						callback(json);
					}catch(e){
						console.log("Unable to get Track [1]");
						return;
					}
				} else {
					console.log("Unable to get Track [2] " + id);
				}
			}).bind(self));
		}else{
			console.log("Unable to get Track [3]");
		}

	}).bind(self));
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
	this.reqStream = request.get({url: track.downloadUrl, headers: this.httpHeaders, jar: true, encoding: null}, function(err, res, body) {
		if(!err && res.statusCode == 200) {
			var decryptedSource = decryptDownload(new Buffer(body, 'binary'), track);
			
			//SET ARTWORK
			request.get(self.albumPictures, {encoding: 'binary'}, function(error,response,body){
								if(error){
									Deezer.logs('Error', error.stack);
								}
								const writer = new ID3Writer(decryptedSource);
								const image = new Buffer (body, 'binary');

								writer.setFrame('APIC', {
										type: 3,
										data: image,
										description: 'front cover'
									});

								writer.addTag();

								const taggedSongBuffer = Buffer.from(writer.arrayBuffer);

								callback(taggedSongBuffer);
								
							});
			

		} else {
			logs("Error","Decryption error");
			callback(err || new Error("Can't download the track"));
		}
	});
}

function decryptDownload(source, track) {
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