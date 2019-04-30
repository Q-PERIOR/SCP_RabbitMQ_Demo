const path = require('path'),
	express = require('express'),
	bodyParser = require('body-parser'),
	cfenv = require('cfenv'),
	appEnv = cfenv.getAppEnv();

var app = express();

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

var oQueueCaches = {
	'Queue_1': [],
	'Queue_2': [],
	'Queue_3': []
};


const amqp = require('amqplib/callback_api');
const sMessagingserviceUri = appEnv.isLocal ?
	'amqp://guest:guest@localhost:5672' :
	appEnv.getService('RabbitMQ_DEMO_2382').credentials.uri;
(function connectToRabbitMQ() {
	amqp.connect(sMessagingserviceUri, function (err, conn) {
		if (err) {
			console.error(err);
			process.exit(0); //fail gracefully
		}
		conn.createChannel(function (err, ch) {
			Object.keys(oQueueCaches).forEach(function (sQueueName) {
				oChannel = ch;
				oChannel.assertQueue(sQueueName, {
					durable: false
				});
				console.log(`Waiting for messages in ${sQueueName}.`);
				oChannel.consume(sQueueName, function (msg) {
					
					oChannel.ack(msg);
				//  Die File:
				//	console.log(msg.content.toString());
					console.log(`Received Data from queue ${sQueueName}`);
				});
			});
		});
	});
})();

const iPort = appEnv.isLocal ? 3001 : appEnv.port;

app.listen(iPort, function () {
	console.log(`Congrats, your consumer app is listening on port ${iPort}!`);
});