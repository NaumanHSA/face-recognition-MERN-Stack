const process = require('process');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const userModel = require("./models");
var express = require('express');
var cors = require('cors');

// paths
const faceapi = require('../api/face-api.node.js');
const modelPathRoot = '../models';
const utils = require('./utils');
const config = require('./config');

let faceDetectionOptions;
let faceMatcher;

var app = express();
app.use(cors(), function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(bodyParser.json({ limit: '50mb' }))

mongoose.connect('mongodb://localhost:27017/usersdb',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "DB connection error: "));
db.once("open", function () {
  console.log("DB Connected successfully");
});

var port = process.env.PORT || 8081
var server = app.listen(port, async function () {
  var port = server.address().port
  await init();
  console.log("Face Recognition app listening at port", port)
});


app.get('/', async function (req, res) {
  res.end("Server Started ...")
});

app.post('/test', async function (req, res) {
  console.log("server ping");
  res.send({ "status": 1 });
});

app.post("/delete_face", async (req, res) => {
  try {
    await userModel.deleteOne({ "name": req.body.person_name });
    res.send({ "status": 1, "message": "person deleted successfully" });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/register', async function (req, res) {

  const imageTensor = await utils.base64ToTensor(req.body.base64);
  console.log(imageTensor);

  const descriptors = [];
  const detections = await faceapi
    .detectAllFaces(imageTensor, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  descriptors.push(detections[0].descriptor);
  const user = new userModel({
    name: req.body.person_name,
    descriptors: descriptors
  });

  try {
    await user.save();
    // update faceMatcher to include the newly registered person
    await initFaceMatcher();
    res.send(user);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/authenticate_web', async function (req, res) {

  const t0 = process.hrtime.bigint();
  if (faceMatcher == null) {
    res.send({ "status": 0, "message": "No registered people found" });
  }
  const imageTensor = await utils.base64ToTensor(req.body.base64);
  const detections = await faceapi
    .detectAllFaces(imageTensor, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();
  imageTensor.dispose();

  if (detections.length == 0) {
    res.send({ "status": 0, "message": "No person was detected to recognize" });
  }
  else if (detections.length > 1) {
    res.send({ "status": 0, "message": "Image contains more than one person. Please try again !!!" });
  }
  else {
    var detectedPerson = null;
    var distance = null;
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
    results.forEach((result, i) => {
      detectedPerson = result._label;
      distance = result._distance;      
    });

    const timeStamp = Math.trunc(parseInt(process.hrtime.bigint() - t0) / 1000 / 1000);
    res.send({
      "status": 1,
      "message": "image processed...",
      "detectedPerson": detectedPerson,
      "distance": distance,
      "time": timeStamp
    });
  }

});

app.post('/db', async function (req, res) {
  const users = await userModel.find({});
  try {
    res.send(users);
  } catch (error) {
    res.status(500).send(error);
  }
});

const init = async () => {
  await faceapi.tf.setBackend('tensorflow');
  await faceapi.tf.enableProdMode();
  await faceapi.tf.ENV.set('DEBUG', false);
  await faceapi.tf.ready();

  const modelPath = path.join(__dirname, modelPathRoot);
  const faceDetectionNet = faceapi.nets.ssdMobilenetv1

  function getFaceDetectorOptions(net) {
    return net === faceapi.nets.ssdMobilenetv1
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: config.minConfidence })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: config.inputSize, scoreThreshold: config.scoreThreshold })
  }

  await faceDetectionNet.loadFromDisk(modelPath);
  faceDetectionOptions = getFaceDetectorOptions(faceDetectionNet);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  await initFaceMatcher();
}

const initFaceMatcher = async () => {
  const registered_perons = await userModel.find({});
  if (registered_perons.length == 0) return;

  allLabeledFaceDescriptors = [];
  for (const person of registered_perons) {
    const name = person.name;
    const discriptions = [];
    for (var discription of person.descriptors) {
      const arr = [];
      for (var key in discription) {
        arr.push(discription[key]);
      }
      const arr_ = new Float32Array(arr);
      discriptions.push(arr_);
    }
    const labeledFaceDescriptors = new faceapi.LabeledFaceDescriptors(name, discriptions);
    allLabeledFaceDescriptors.push(labeledFaceDescriptors);
  }
  faceMatcher = new faceapi.FaceMatcher(allLabeledFaceDescriptors, 0.6);
}
