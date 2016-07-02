import fs from 'fs'
import Queue, {QueueConsumer} from 'blocking-queue'
import handbrake from 'handbrake-js'

function process(options){
  return new Promise((resolve, reject)=>{
    handbrake.spawn(options)
      .on('error', (error)=> resolve('process_error', error))
      .on('complete', () => resolve('process_end'))
  })
}

export default function(concurrency=1){
    // コマンド実行を直列処理する
    const queue = new Queue()
    new QueueConsumer(queue).start(({event, options, dispatch})=>{
      console.log(`dispatch: ${event.name} handbrake`)
      event.result.content = fs.readFileSync(event.result.path, 'utf8')
      
      options.input = event.result.content
      options.output = event.result.content + 'mp4'
      
      return process(options)
        .then((status, error)=> new Promise((resolve, reject)=>{
          if (error) event.result.error = error
          dispatch({name: event.name, status, result: event.result})
          fs.unlink(event.result.path, resolve)
        }))
    }, concurrency)
    return queue
}