const fs = require('fs');

/**
 * 该函数同步的拷贝内容从一个路径到另外一个路径.  
 * 该函数利用给定的buffer作为读写交换的空间.  
 * 在Buffer的内存分配上可以使用内存不安全的Buffer.  
 * **注意**:函数内部不会做任何容错处理,确保你传入的参数都是有效的.
 * **注意**:建议外部包裹一层try/catch
 * @param {Number} ReadFD 读文件的fd
 * @param {Number} WriteFD 写文件的fd
 * @param {Buffer} buffer 被用作读写交换空间的buffer
 * @param {Boolean} autoClose 是否读写完成后自动关闭默认true
 * @param {Function} callback 可选参数如果提供则在每次的读取中交由外部处理并跟随传入的buffer
 */
function copy(ReadFD, WriteFD, buffer, autoClose, callback) {
  var
    BufferSize = buffer.length,
    { size: FileSize } = fs.fstatSync(ReadFD),
    lastOffset = FileSize % BufferSize;

  var count = 0;

  if (callback) {
    while ((count = fs.readSync(ReadFD, buffer, 0, BufferSize, null)) && count === BufferSize) {
      callback(buffer);
      fs.writeSync(WriteFD, buffer);
    }
    if (lastOffset) {
      const currentBuffer = buffer.slice(0, lastOffset);
      callback(currentBuffer);
      fs.writeSync(WriteFD, currentBuffer, 0, lastOffset)
    }
  } else {
    while ((count = fs.readSync(ReadFD, buffer, 0, BufferSize, null)) && count === BufferSize) {
      fs.writeSync(WriteFD, buffer);
    }
    if (lastOffset) {
      fs.writeSync(WriteFD, buffer.slice(0, lastOffset), 0, lastOffset)
    }
  }

  if (autoClose) {
    fs.closeSync(WriteFD);
    fs.closeSync(ReadFD);
  }

}


/**
 * 该函数使用基本的流来进行文件的拷贝.  
 * 这个函数提供了一个回调用于在读取到内容的时候交由外部处理.
 * 当读取流触发end事件同时写入流触发drain事件后这则停止交由外部处理.
 * 这个回调函数格式如下:
 * - modifyFun:(buffer:Buffer,stop?:()=>void)=>void
 *  - buffer 每次读取到的数据
 *  - stop 当回调中需要执行异步操作的时候需要在开始的时候就调用该方法并且传入false  
 * 此时会停止流读取异步执行完成再次无参调用即可恢复流式读写.  
 * **注意**:同步操作无视该回调参数即可.
 * 
 * **注意**:传入回调中的buffer是对buffer的引用.
 * **注意**:本函数内部没有提供任何容错处理,请确保提供的参数都是有效的.
 * **注意**:建议在外部给传入的流添加error事件监听
 * @param {ReadStream} readStream 可读流
 * @param {WriteStream} writeStream 可写流
 * @param {Function} modifyFun 修改数据的函数
 */
function streamModifyer(readStream, writeStream, modifyFun) {

  function write(chunk) {
    if (!writeStream.write(chunk)) {
      readStream.pause();
    }
  }

  var readFun = (function (modifyFun) {
    if(modifyFun){
      return function (chunk) {

        var isTrigger = false;

        modifyFun(chunk, function (stop) {

          if (!isTrigger) {
            if (stop) {
              isTrigger = true;
              readStream.pause();
              return true;
            } else {
              return false;
            }
          }

          if (isTrigger) {
            if (!stop) {
              readStream.resume();
              write(chunk);
              return true;
            } else {
              return false;
            }
          }

          return false;
        });

        if (!isTrigger) {
          write(chunk);
        }

      }
    }else{
      return write;
    }
  })(modifyFun);
  
  function resumeFun() {
      readStream.resume();
  }

  readStream.on('data', readFun);
  writeStream.on('drain', resumeFun);
  readStream.once('end', function () {
    readStream.off('data',readFun);
    writeStream.off('drain',resumeFun);
  });

}

module.exports = {
  copy: copy,
  streamModifyer: streamModifyer
}




