import path from 'path'
import chokidar from 'chokidar'
import rest from 'restler'
import config from 'config'
import exec_queue from './exec-queue'
import handbrake from './handbrake'

console.dir(config)
const event = config.event

const queue = exec_queue()
const encode = handbrake()

function env(key){
  return config.env[key] || key
}

function dispatch(e){
  console.log(`event: ${e.name} ${e.status} ${e.result.path}`)
  const sender = event[e.name] && event[e.name][e.status]
  if (sender && sender.url){
    const url = env(sender.url)
    console.log(`dispatch: ${url}`)
    rest.postJson(url, e)
      .on('error', (err, res)=>{
        console.log(`dispatch: ${url} ERROR`)
        console.dir({err, res})
      })
  }
  if (sender && sender.exec){
    const exec = env(sender.exec)
    queue.push({event: e, exec, dispatch})
  }
  if (sender && sender.handbrake){
    sender.handbrake.workdir = env(sender.handbrake.workdir)
    sender.handbrake.outdir = env(sender.handbrake.outdir)
    sender.handbrake.enddir = env(sender.handbrake.enddir)
    encode.push({event: e, args: sender.handbrake, dispatch})
  }
}

function watch(name, watcher){
  const watchroot = env(watcher.root)
  const watchpattern = env(watcher.pattern)
  const watchpath = path.join(watchroot, watchpattern)
  console.log(`監視します: ${name} ${watchpath}`)
  
  chokidar.watch(watchpath, {ignored: /[\/\\]\./, persistent: true})
    .on('error', (error)=>{
      console.log('watch: ERROR')
      console.dir(error)
      dispatch({
        name,
        status: 'watch_error',
        result: {error, root: watchroot},
      })
    })
    .on('all', (event, filepath)=>{
      const filename = path.basename(filepath)
      const dir = path.dirname(filepath).slice(watchroot.length)
      dispatch({
        name,
        status: event,
        result: {path: filepath, filename, dir, root: watchroot},
      })
    })
}

for (let name in event){
  watch(name, event[name])
}