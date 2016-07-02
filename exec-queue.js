import fs from 'fs'
import {spawn} from 'child_process'
import Queue, {QueueConsumer} from 'blocking-queue'

function process(exec, args, options){
  return new Promise((resolve, reject)=>{
    spawn(exec, args, options)
      .on('error', (error)=> resolve('process_error', error))
      .on('close', (code) => resolve('process_end'))
  })
}

export default function(concurrency=1){
    // コマンド実行を直列処理する
    const queue = new Queue()
    new QueueConsumer(queue).start(({event, exec, dispatch})=>{
      console.log(`dispatch: ${event.name} ${exec}`)
      event.result.content = fs.readFileSync(event.result.path, 'utf8')
      const args = [event.result.filename, event.result.content]
      console.dir(args)
      
      return process(exec, args, { stdio: 'ignore' })
        .then((status, error)=> new Promise((resolve, reject)=>{
          if (error) event.result.error = error
          dispatch({name: event.name, status, result: event.result})
          fs.unlink(event.result.path, resolve)
        }))
    }, concurrency)
    return queue
}