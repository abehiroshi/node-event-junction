import fs from 'fs'
import {spawn} from 'child_process'
import chokidar from 'chokidar'
import rest from 'restler'
import config from 'config'

console.dir(config)
const event = config.event

function dispatch(e){
  console.log(`event: ${e.name} ${e.status} ${e.result.path}`)
  const sender = event[e.name] && event[e.name][e.status]
  if (sender && sender.url){
    console.log(`dispatch: ${sender.url}`)
    rest.postJson(sender.url, e)
      .on('error', (err, res)=>{
        console.log(`dispatch: ${sender.url} ERROR`)
        console.dir({err, res})
      })
  }
  if (sender && sender.exec){
    console.log(`dispatch: ${sender.exec} START`)
    e.result.content = fs.readFileSync(e.result.path, 'utf8')
    const args = [e.result.filename, e.result.content]
    console.dir(args)
    spawn(sender.exec, args, {
      stdio: 'ignore'
    })
      .on('error', (error)=>{
        console.log(`dispatch: ${sender.exec} ERROR`)
        console.dir(error)
      })
      .on('close', (code)=>{
        console.log(`dispatch: ${sender.exec} END(${code})`)
        fs.unlinkSync(e.result.path)
        dispatch({
          name: e.name,
          status: 'process_end',
          result: e.result,
        })
      })
  }
}

function cutTail(str, keyword){
  const splited = str.split(keyword)
  return splited[splited.length - 1]
}

function watch(name, watcher){
  console.log(`監視します: ${name} ${watcher.path}`)
  chokidar.watch(watcher.path, {ignored: /[\/\\]\./, persistent: true})
    .on('error', (error)=>{
      console.log('watch: ERROR')
      console.dir(error)
      dispatch({
        name,
        status: 'error',
        result: {error},
      })
    })
    .on('all', (event, path)=>{
      const filename = cutTail(path, '/')
      dispatch({
        name,
        status: event,
        result: {path, filename},
      })
    })
}

for (let name in event){
  watch(name, event[name])
}