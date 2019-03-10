const copy = require('./index.js');
const fs = require('fs');
const path = require('path');

const ReadFd = fs.openSync(path.join(__dirname,'index.js'),'r');
const WriteFd = fs.openSync(path.join(__dirname,'index.copy.js'),'w');

try {
  copy.copy(ReadFd,WriteFd,Buffer.allocUnsafe(1024*1024),true,function (buffer) {
    console.count('buffer');
  });
} catch (error) {
  console.log(error);
}

const readStream = fs.createReadStream(path.join(__dirname, 'copy.bin'),{
  encoding:null,
  autoClose:true
});

const writeStream = fs.createWriteStream(path.join(__dirname,'copy.copy.bin'),{
  encoding:null,
  autoClose:true
});

copy.streamModifyer(readStream,writeStream,(chunk)=>{
  let len = chunk.length;
  while (len--) {
    chunk[len] = ~chunk[len];
  }
});

writeStream.on('error',error=>console.log(error));
readStream.on('error',error=>console.log(error));