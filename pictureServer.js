/*
server.js

Authors:David Goedicke (da.goedicke@gmail.com) & Nikolas Martelaro (nmartelaro@gmail.com)

This code is heavily based on Nikolas Martelaroes interaction-engine code (hence his authorship).
The  original purpose was:
This is the server that runs the web application and the serial
communication with the micro controller. Messaging to the micro controller is done
using serial. Messaging to the webapp is done using WebSocket.

//-- Additions:
This was extended by adding webcam functionality that takes images remotely.

Usage: node server.js SERIAL_PORT (Ex: node server.js /dev/ttyUSB0)

Notes: You will need to specify what port you would like the webapp to be
served from. You will also need to include the serial port address as a command
line input.
*/

let express = require('express'); // web server application
let app = express(); // webapp
let http = require('http').Server(app); // connects http library to server
let io = require('socket.io')(http); // connect websocket library to server
let serverPort = 8000;
let SerialPort = require('serialport'); // serial library
let Readline = SerialPort.parsers.Readline; // read serial data as lines
//-- Addition:
let NodeWebcam = require( "node-webcam" );// load the webcam module

let request = require('superagent');
let path = require('path');
let fs = require('fs');

//---------------------- WEBAPP SERVER SETUP ---------------------------------//
// use express to create the simple webapp
app.use(express.static('public')); // find pages in public directory

// check to make sure that the user provides the serial port for the Arduino
// when running the server
if (!process.argv[2]) {
  console.error('Usage: node ' + process.argv[1] + ' SERIAL_PORT');
  process.exit(1);
}

// start the server and say what port it is on
http.listen(serverPort, function() {
  console.log('listening on *:%s', serverPort);
});
//----------------------------------------------------------------------------//

//--Additions:
//----------------------------WEBCAM SETUP------------------------------------//
//Default options
let opts = { //These Options define how the webcam is operated.
    //Picture related
    width: 1280, //size
    height: 720,
    quality: 100,
    //Delay to take shot
    delay: 0,
    //Save shots in memory
    saveShots: true,
    // [jpeg, png] support varies
    // Webcam.OutputTypes
    output: "jpeg",
    //Which camera to use
    //Use Webcam.list() for results
    //false for default device
    device: false,
    // [location, buffer, base64]
    // Webcam.CallbackReturnTypes
    callbackReturn: "location",
    //Logging
    verbose: false
};
let Webcam = NodeWebcam.create( opts ); //starting up the webcam
//----------------------------------------------------------------------------//



//---------------------- SERIAL COMMUNICATION (Arduino) ----------------------//
// start the serial port connection and read on newlines
const serial = new SerialPort(process.argv[2], {});
const parser = new Readline({
  delimiter: '\r\n'
});

let takePicture = () => {
  /// First, we create a name for the new picture.
    /// The .replace() function removes all special characters from the date.
    /// This way we can use it as the filename.
    let imageName = new Date().toString().replace(/[&\/\\#,+()$~%.'":*?<>{}\s-]/g, '');

    let url = 'https://dreamscopeapp.com/api/images';

    console.log('making a picture at'+ imageName); // Second, the name is logged to the console.

    //Third, the picture is  taken and saved to the `public/`` folder
    NodeWebcam.capture('public/'+imageName, opts, function( err, data ) {
      var GIFEncoder = require('gifencoder');
      var Canvas = require('canvas');
      var fs = require('fs');

      var encoder = new GIFEncoder(320, 240);
      // stream the results as they are available into myanimated.gif
      encoder.createReadStream().pipe(fs.createWriteStream('myanimated.gif'));

      encoder.start();
      encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
      encoder.setDelay(500);  // frame delay in ms
      encoder.setQuality(10); // image quality. 10 is default.

      // use node-canvas
      var canvas = new Canvas(320, 240);
      var ctx = canvas.getContext('2d');

      // red rectangle
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 320, 240);
      encoder.addFrame(ctx);

      // green rectangle
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, 320, 240);
      encoder.addFrame(ctx);

      // blue rectangle
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, 320, 240);
      encoder.addFrame(ctx);

      encoder.finish();
      io.emit('newPicture',('myanimated.gif')); ///Lastly, the new name is send to the client web browser.
    });
}

// Read data that is available on the serial port and send it to the websocket
serial.pipe(parser);
parser.on('data', function(data) {
  console.log('Data:', data);
  io.emit('server-msg', data);
  if (data === 'light') {
    takePicture();
  }
});
//----------------------------------------------------------------------------//


//---------------------- WEBSOCKET COMMUNICATION (web browser)----------------//
// this is the websocket event handler and say if someone connects
// as long as someone is connected, listen for messages
io.on('connect', function(socket) {
  console.log('a user connected');

  // if you get the 'ledON' msg, send an 'H' to the Arduino
  socket.on('ledON', function() {
    console.log('ledON');
    serial.write('H');
  });

  // if you get the 'ledOFF' msg, send an 'L' to the Arduino
  socket.on('ledOFF', function() {
    console.log('ledOFF');
    serial.write('L');
  });

  //-- Addition: This function is called when the client clicks on the `Take a picture` button.
  socket.on('takePicture', takePicture);
  // if you get the 'disconnect' message, say the user disconnected
  socket.on('disconnect', function() {
    console.log('user disconnected');
  });
});
//----------------------------------------------------------------------------//
