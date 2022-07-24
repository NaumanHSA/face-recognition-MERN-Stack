const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');

// paths
const dataJsonFile = path.join(__dirname, "data", "data.json")

module.exports = {
    loadJsonData: async function () {
        // save the data
        if (fs.existsSync(dataJsonFile)) {
            fs.readFile(dataJsonFile, 'utf8', async function readFileCallback(err, data) {
                if (err) res.send({ "status": false, "message": "unable to read db" });
                obj = JSON.parse(data);

                // check for existing person
                var discriptions = []

                obj.known_faces.forEach((item) => {
                    var person = Object.keys(item)[0];
                    var buffer = item[person];

                    const newFloat32Array = new Float32Array(buffer.buffer)
                    console.log(buffer);
                });

            });
        }
        else {
            return null;
        }
    },
    
    imageToTensor: async function (img) {
        const buffer = fs.readFileSync(img);
        const decoded = tf.node.decodeImage(buffer);
        const casted = decoded.toFloat();
        const result = casted.expandDims(0);
        decoded.dispose();
        casted.dispose();
        return result;
    },

    decodeBase64: async function (dataString) {
        var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
            response = {};

        if (matches.length !== 3) {
            return new Error('Invalid input string');
        }
        response.type = matches[1];
        response.data = matches[2];
        // response.data = new Buffer(matches[2], 'base64');
        return response
    },

    base64ToTensor: async function(b64string) {
        const b64string_ = b64string.replace(/^data:image\/(png|jpeg);base64,/, "");
        var buffer = Buffer.from(b64string_, 'base64');
        const decoded = tf.node.decodeImage(buffer);
        const casted = decoded.toFloat();
        const result = casted.expandDims(0);
        decoded.dispose();
        casted.dispose();
        return result;
    }
}