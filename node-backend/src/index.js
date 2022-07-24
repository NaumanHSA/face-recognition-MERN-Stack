// import packages
const process = require('process');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const userModel = require("./models");
var express = require('express');
var cors = require('cors');

// specify the paths
const faceapi = require('../api/face-api.node.js');   // face-api code path
const modelPathRoot = '../models';  // path where models have been placed
const utils = require('./utils');   // path to utils
const config = require('./config'); // path to config file

let faceDetectionOptions;
let faceMatcher;

var app = express();

// allow front-end react app to cors policy
app.use(cors(), function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(bodyParser.json({ limit: '50mb' }))

// connect to mongo DB
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

// initialize the server on port 8081 or assign dynamically
// while intializing the server, also call the init method to initialize models etc.
var port = process.env.PORT || 8081
var server = app.listen(port, async function () {
  var port = server.address().port
  await init();
  console.log("Face Recognition app listening at port", port)
});


app.get('/', async function (req, res) {
  res.end("Server Started ...")
});

// api end point to server ping
app.post('/test', async function (req, res) {
  console.log("server ping");
  res.send({ "status": 1 });
});

// api end point to delete a user from the db based on its name/email
app.post("/delete_face", async (req, res) => {
  try {
    await userModel.deleteOne({ "name": req.body.person_name });
    res.send({ "status": 1, "message": "person deleted successfully" });
  } catch (error) {
    res.status(500).send(error);
  }
});

// api end point to register a person. The request must contains an image of the user along with his name/email.
app.post('/register', async function (req, res) {

  // convert base64 image into tensor to work with tfjs in the faceapi
  const imageTensor = await utils.base64ToTensor(req.body.base64);
  // console.log(imageTensor);

  // pass the tensor along with face detection options to the faceapi to get face descriptors (128 values)
  const descriptors = [];
  const detections = await faceapi
    .detectAllFaces(imageTensor, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  // assuming the image contains only one face, select the first one
  descriptors.push(detections[0].descriptor);

  // save the user and the face descriptors in the db
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

// api endpoint to authenticate a new face
// request body must contain an image in base64 code
app.post('/authenticate_web', async function (req, res) {

  // if database has no faces registered, then return error message
  const t0 = process.hrtime.bigint();
  if (faceMatcher == null) {
    res.send({ "status": 0, "message": "No registered people found" });
  }

  // convert base64 image into tensor to work with tfjs in the faceapi
  const imageTensor = await utils.base64ToTensor(req.body.base64);
  const detections = await faceapi
    .detectAllFaces(imageTensor, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();
  imageTensor.dispose();

  // if no faces were found in the new image, return err message
  if (detections.length == 0) {
    res.send({ "status": 0, "message": "No person was detected to recognize" });
  }
  // if more then 1 faces were found, then return an err message
  else if (detections.length > 1) {
    res.send({ "status": 0, "message": "Image contains more than one person. Please try again !!!" });
  }
  // compare the new face with all registered faces in the database
  else {
    var detectedPerson = null;
    var distance = null;

    // find the best match from the database using Euclidian distance
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
    results.forEach((result, i) => {
      detectedPerson = result._label;
      distance = result._distance;      
    });

    // send the response back to the user
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

// api end point to show all registered people in the database
app.post('/db', async function (req, res) {
  const users = await userModel.find({});
  try {
    res.send(users);
  } catch (error) {
    res.status(500).send(error);
  }
});

// method to setup the environment before doing any operation
const init = async () => {

  // set the faceapi parameters
  await faceapi.tf.setBackend('tensorflow');
  await faceapi.tf.enableProdMode();
  await faceapi.tf.ENV.set('DEBUG', false);
  await faceapi.tf.ready();

  // set the absolute path the models directory
  const modelPath = path.join(__dirname, modelPathRoot);
  const faceDetectionNet = faceapi.nets.ssdMobilenetv1

  // method to pass the parameters to the model for face detection.
  function getFaceDetectorOptions(net) {
    return net === faceapi.nets.ssdMobilenetv1
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: config.minConfidence })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: config.inputSize, scoreThreshold: config.scoreThreshold })
  }

  // load the model for face detection
  await faceDetectionNet.loadFromDisk(modelPath);
  faceDetectionOptions = getFaceDetectorOptions(faceDetectionNet);

  // load the models for face landmarks and embeddings
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  await initFaceMatcher();
}

// method to init/update the facemather object which is responsible for matching any face
// with the known faces in the database. 
// This methos is called after every operation that changes the db e.g. registering a new person, deleting a person.
const initFaceMatcher = async () => {

  // find all registered persons from the database
  const registered_perons = await userModel.find({});
  if (registered_perons.length == 0) return;

  // iterate through everyone of them and get the discriptors for each
  // then initialize an new faceMatcher object with those descriptors
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
