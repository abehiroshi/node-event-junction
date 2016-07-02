import fs from 'fs'
import path from 'path'
import Queue, {QueueConsumer} from 'blocking-queue'
import handbrake from 'handbrake-js'

function process(options){
  return new Promise((resolve, reject)=>{
    handbrake.spawn(options)
      .on('error', (error)=> resolve({status: 'process_error', error}))
      .on('complete', () => resolve({status: 'process_end'}))
  })
}

export default function(concurrency=1){
    // コマンド実行を直列処理する
    const queue = new Queue()
    new QueueConsumer(queue).start(({event, args, dispatch})=>{
      console.log(`dispatch: ${event.name} handbrake`)
      event.result.content = fs.readFileSync(event.result.path, 'utf8')
      const contents = event.result.content.split('\n')
      const filepath = contents[0]
      const dir = contents[1] || '.'
      const infilename = path.basename(filepath)
      const outfilename = path.basename(filepath, path.extname(filepath)) + args.extension
      
      args.options.input = path.join(args.workdir, infilename)
      args.options.output = path.join(args.workdir, outfilename)
      
      return new Promise((resolve)=>fs.rename(filepath, args.options.input, resolve))
        .then(()=>process(args.options))
        .then(({status, error})=> new Promise((resolve, reject)=>{
          fs.unlink(event.result.path, resolve)
          
          if (error){
            event.result.error = error
          } else {
            const outdir = path.join(args.outdir, dir)
            const enddir = path.join(args.enddir, dir)
            fs.mkdir(outdir, ()=>fs.rename(args.options.output, path.join(outdir, outfilename), ()=>{}))
            fs.mkdir(enddir, ()=>fs.rename(args.options.input, path.join(enddir, infilename), ()=>{}))
          }
          dispatch({name: event.name, status, result: event.result})
        }))
    }, concurrency)
    return queue
}