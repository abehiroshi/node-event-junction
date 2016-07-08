import fs from 'fs'
import path from 'path'
import Queue, {QueueConsumer} from 'blocking-queue'
import handbrake from 'handbrake-js'

export default function(concurrency=1){
    // コマンド実行を直列処理する
    const queue = new Queue()
    new QueueConsumer(queue).start(({event, args, dispatch})=>{
      console.log(`dispatch: ${event.name} handbrake`)
      const filepath = event.result.content.path
      const dir = event.result.content.dir || '.'
      const infilename = path.basename(filepath)
      const outfilename = path.basename(filepath, path.extname(filepath)) + args.extension
      
      args.options.input = path.join(args.workdir, infilename)
      args.options.output = path.join(args.workdir, outfilename)
      event.result.options = args.options
      
      return new Promise((resolve)=>fs.rename(filepath, args.options.input, resolve))
        .then(()=> new Promise((resolve)=>{
          handbrake.spawn(args.options)
            .on('error', (err)=> resolve({status: 'process_error', err}))
            .on('complete', () => resolve({status: 'process_end'}))
        }))
        .then(({status, err})=> new Promise((resolve, reject)=>{
          fs.unlink(event.result.path, resolve)
          
          if (err){
            event.result.error = err
          } else {
            const outdir = path.join(args.outdir, dir)
            const enddir = path.join(args.enddir, dir)
            fs.mkdir(outdir, ()=>fs.rename(args.options.output, path.join(outdir, outfilename), ()=>{}))
            fs.mkdir(enddir, ()=>fs.rename(args.options.input, path.join(enddir, infilename), ()=>{}))
          }
          dispatch({name: event.name, status, result: event.result})
        }))
        .catch((reason)=> console.log(`ERROR: handbrake ${reason}`))
    }, concurrency)
    return queue
}