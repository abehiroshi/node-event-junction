import fs from 'fs'
import path from 'path'
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
    new QueueConsumer(queue).start(({event, args, dispatch})=>{
      console.log(`dispatch: ${event.name} handbrake`)
      event.result.content = fs.readFileSync(event.result.path, 'utf8')
      const filepath = event.result.content
      const infilename = path.basename(filepath)
      const outfilename = path.basename(filepath, path.extname(filepath)) + args.extension
      
      fs.renameSync(filepath, path.join(args.workdir, infilename))
      args.options.input = path.join(args.workdir, infilename)
      args.options.output = path.join(args.workdir, outfilename)
      
      return process(args.options)
        .then((status, error)=> new Promise((resolve, reject)=>{
          if (error){
            event.result.error = error
          } else {
            fs.rename(args.options.output, path.join(args.outdir, outfilename), ()=>{})
            fs.rename(args.options.input, path.join(args.enddir, infilename), ()=>{})
          }
          dispatch({name: event.name, status, result: event.result})
          fs.unlink(event.result.path, resolve)
        }))
    }, concurrency)
    return queue
}