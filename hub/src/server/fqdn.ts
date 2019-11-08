import * as child_process from 'child_process'
import * as os from 'os'
import * as dns from 'dns'

export async function getUsingNodeDns() {
  const osHostname = os.hostname()
  const ip = await new Promise<string>((resolve, reject) => {
    dns.lookup(osHostname, { hints: dns.ADDRCONFIG }, (error, ip) => {
      if (error) {
        reject(error)
      } else {
        resolve(ip)
      }
    });
  })
  const hostname = await new Promise<string>((resolve, reject) => {
    dns.lookupService(ip, 0, (error, hostname, service) => {
      if (error) {
        reject(error)
      } else {
        console.log(service)
        resolve(hostname)
      }
    });
  })
  return hostname
}

function getUsingUnixShell() {
  const stdoutResult = child_process.execSync('hostname -f', { encoding: 'utf8' })
  const trimmedHost = stdoutResult.replace(/\n/g, '')
  return trimmedHost
}

function getUsingWindowsShell() {
  // From https://github.com/stheine/fqdn-multi/blob/master/lib/fqdn.js
  // On Windows, run 'ipconfig /all' and merge the data from
  // 'Host Name' and 'Primary Dns Suffix' to get the fqdn.
  const stdoutResult = child_process.execSync('ipconfig /all', { encoding: 'utf8' })
  let hostName: string
  let primaryDnsSuffix: string
  stdoutResult.split(/\r?\n/)
    .filter(line => /^ *(Host Name|Primary Dns Suffix)/.test(line))
    .forEach(line => {
      line = line.trim();
      const key = line.replace(/ \..*$/, '').trim()
      if (key === 'Host Name') {
        hostName = line.replace(/^.* : /, '').trim()
      } else if (key === 'Primary Dns Suffix') {
        primaryDnsSuffix = line.replace(/^.* : /, '').trim()
      }
    })
  return `${hostName}.${primaryDnsSuffix}`
}

export function getHostname() {
  if (process.platform !== 'win32') {
    return getUsingUnixShell()
  } else {
    return getUsingWindowsShell()
  }
}
