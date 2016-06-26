import fs from 'fs'
import {spawn} from 'child_process'
import Queue, {QueueConsumer} from 'blocking-queue'

export default function(concurrency=1){
    // コマンド実行を直列処理する
    const queue = new Queue()
    new QueueConsumer(queue).start(({event, exec, dispatch})=>{
      console.log(`dispatch: ${event.name} ${exec}`)
      event.result.content = fs.readFileSync(event.result.path, 'utf8')
      const args = [event.result.filename, event.result.content]
      console.dir(args)
      
      return new Promise((resolve, reject)=>{
        spawn(exec, args, { stdio: 'ignore' })
          .on('error', (error)=>{
            fs.unlinkSync(event.result.path)
            resolve()
            dispatch({
              name: event.name,
              status: 'process_error',
              result: {error},
            })
          })
          .on('close', (code)=>{
            fs.unlinkSync(event.result.path)
            resolve()
            dispatch({
              name: event.name,
              status: 'process_end',
              result: event.result,
            })
          })
      })
    }, concurrency)
    return queue
}