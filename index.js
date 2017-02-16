import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import rest from 'restler'
import config from 'config'
import exec_queue from './exec-queue'
import handbrake from './handbrake'
import amazon from './amazon'

const queue = exec_queue()
const encode = handbrake()

let _env = config.env
function env(key){
  return _env[key] || key
}

function dispatch(e){
  console.log(`event: ${e.name} ${e.status} ${e.result.path}`)
  let sender = config.event[e.name] && config.event[e.name][e.status]
  if (sender === undefined){
    console.log(`  dispatcher '${e.name}.${e.status}' is not found.`)
    return
  }
  sender = JSON.parse(JSON.stringify(sender))

  if (sender.content_type === 'json'){
    e.result.content = JSON.parse(fs.readFileSync(e.result.path, 'utf8'))
  }

  if (sender.url){
    const url = env(sender.url)
    console.log(`dispatch: ${url}`)
    rest.postJson(url, e)
      .on('error', (err, res)=>{
        console.log(`dispatch: ${url} ERROR`)
        console.dir({err, res})
      })
  }
  if (sender.method === 'amazon'){
     amazon.order({event: e, args: sender.args, dispatch})
  }
  if (sender.exec){
    const exec = env(sender.exec)
    queue.push({event: e, exec, dispatch})
  }
  if (sender.handbrake){
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
      const base = path.basename(filepath, path.ext(filepath))
      const filename = path.basename(filepath)
      const dir = path.dirname(filepath).slice(watchroot.length)
      dispatch({
        name,
        status: event,
        result: {path: filepath, base, filename, dir, root: watchroot},
      })
    })
}

function start(event) {
  console.log('START')
  console.dir({env: _env, event: event})
  for (let name in event){
    watch(name, event[name])
  }
}

amazon.auth(process.argv[3], process.argv[4])

if (process.argv[2]) {
  rest.get(process.argv[2])
    .on('success', (data)=>{
      _env = Object.assign(config.env, data.env || {})
      start(Object.assign(config.event, data.event || {}))
    })
    .on('error', (err)=>{
      console.log(`ERROR config: ${process.argv[2]}`)
      console.dir(err)
    })
} else {
  start(config.event)
}

