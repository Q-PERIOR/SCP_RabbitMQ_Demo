const path = require('path'),
	express = require('express'),
	cfenv = require('cfenv'),
	appEnv = cfenv.getAppEnv(),
	amqp = require('amqplib'),
	dfs = require('dropbox-fs')({
		apiKey: appEnv.getService('Dropbox_2382').credentials.apiKey
	});
console.log(appEnv.getService('Dropbox_2382').credentials.apiKey);
var app = express();
const sMessagingserviceUri = appEnv.getService('RabbitMQ_DEMO_2382').credentials.uri;

async function connectToRabbitMQ() {
	try {
		var conn = await amqp.connect(sMessagingserviceUri);
		var oChannel = await conn.createChannel();
	} catch (err) {
		console.error(err);
		process.exit(0); //fail gracefully
	} finally {
		return oChannel;
	}
}

app.use('/', express.static(path.join(__dirname, 'webapp')));

const iPort = appEnv.isLocal ? 3000 : appEnv.port;

app.listen(iPort, function () {
	console.log(`Congrats, your producer app is listening on port ${iPort}!`);
});

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

app.post('/send', async function (oReq, oRes) {

	// Erstelle Channel
	var oChannel = await connectToRabbitMQ();

	const sDefaultQueue = 'Queue_1';
	// Lese Request aus
	var oMessage = {
		queue: oReq.body.queue || sDefaultQueue
	}

	// Warteschlange bestätigen - Name
	oChannel.assertQueue(oMessage.queue, {
		durable: false
	});

	

	var readFiles = new Promise(
		function (resolve, reject) {
			dfs.readdir('/Wait', (err, files) => {
				console.log(files);
				resolve(files);
			});
		}
	);

	readFiles.then(function (files) {
		async function asyncForEach(array, callback) {
			for (let index = 0; index < array.length; index++) {
				await callback(array[index], index, array);
			}
		}
		const waitFor = ((file) => new Promise(
			function (resolve, reject) {
				dfs.readFile('/Wait/' + file, {
					encoding: 'utf8'
				}, async(err, result) => {
					oChannel.sendToQueue(oMessage.queue, new Buffer(result), {
						persistent: true
					});
				});
				dfs.rename('/Wait/' + file, '/Done/' + file, err => {
					if (err) {
						console.error('Failed!');
						console.log(file);
						resolve();
					} else {
						console.log('Moved!');
						console.log(file);
						resolve();
					}
				});

			}
		));
		const start = async() => {
			await asyncForEach(files, async(file) => {
				await waitFor(file);
			});
			console.log('Done');
			oRes.sendStatus(200);
		}
		start();
	});
});
