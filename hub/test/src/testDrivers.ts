import test = require('tape-promise/tape')
import { sandbox, FetchMockSandbox } from 'fetch-mock'
import NodeFetch from 'node-fetch'

import { Readable, PassThrough } from 'stream'
import { DriverModel, DriverModelTestMethods } from '../../src/server/driverModel'
import * as utils from '../../src/server/utils'

import * as mockTestDrivers from './testDrivers/mockTestDrivers'
import * as integrationTestDrivers from './testDrivers/integrationTestDrivers'
import { BadPathError, DoesNotExist, ConflictError } from '../../src/server/errors'

export function addMockFetches(fetchLib: FetchMockSandbox, prefix: any, dataMap: {key: string, data: string}[]) {
  dataMap.forEach(item => {
    fetchLib.get(`${prefix}${item.key}`, item.data, { overwriteRoutes: true })
  })
}


function testDriver(testName: string, mockTest: boolean, dataMap: {key: string, data: string}[], createDriver: (config?: any) => DriverModel) {

  test(testName, async (t) => {
    const topLevelStorage = `${Date.now()}r${Math.random()*1e6|0}`
    const cacheControlOpt = 'no-cache, no-store, must-revalidate'
    const driver = createDriver({
      pageSize: 3,
      cacheControl: cacheControlOpt
    })
    try {
      await driver.ensureInitialized()
      const prefix = driver.getReadURLPrefix()
      const sampleDataString = 'hello world'
      const getSampleData = () => {
        const contentBuff = Buffer.from(sampleDataString)
        const s = new Readable()
        s.push(contentBuff)
        s.push(null)
        return { stream: s, contentLength: contentBuff.length }
      }

      const fetch = (mockTest ? sandbox() : NodeFetch) as FetchMockSandbox

      try {
        const writeArgs : any = { path: '../foo.js'}
        await driver.performWrite(writeArgs)
        t.fail('Should have thrown')
      }
      catch (err) {
        t.equal(err.message, 'Invalid Path', 'Should throw bad path')
      }

      const fileSubDir = 'somedir'
      // Test binary data content-type
      const binFileName = `${fileSubDir}/foo.bin`;
      let sampleData = getSampleData();
      let writeResponse = await driver.performWrite({
        path: binFileName,
        storageTopLevel: topLevelStorage,
        stream: sampleData.stream,
        contentType: 'application/octet-stream',
        contentLength: sampleData.contentLength
      });
      let readUrl = writeResponse.publicURL;
      t.ok(readUrl.startsWith(`${prefix}${topLevelStorage}`), `${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}`)

      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      let resp = await fetch(readUrl)
      t.ok(resp.ok, 'fetch should return 2xx OK status code')
      let resptxt = await resp.text()
      t.equal(resptxt, sampleDataString, `Must get back ${sampleDataString}: got back: ${resptxt}`)
      if (!mockTest) {
        t.equal(resp.headers.get('content-type'), 'application/octet-stream', 'Read endpoint response should contain correct content-type')
        t.equal(resp.headers.get('etag'), writeResponse.etag,
          'Read endpoint should contain correct etag')
        t.equal(resp.headers.get('cache-control'), cacheControlOpt, 'cacheControl not respected in response headers')
      }

      let files = await driver.listFiles({pathPrefix: topLevelStorage})
      t.equal(files.entries.length, 1, 'Should return one file')
      t.equal(files.entries[0], binFileName, `Should be ${binFileName}!`)
      t.ok(!files.page, 'list files for 1 result should not have returned a page')

      // Test a text content-type that has implicit charset set
      const txtFileName = `${fileSubDir}/foo_text.txt`;
      sampleData = getSampleData();
      writeResponse = await driver.performWrite(
          { path: txtFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: sampleData.contentLength,
            ifNoneMatch: '*' })
      readUrl = writeResponse.publicURL;
      t.ok(readUrl.startsWith(`${prefix}${topLevelStorage}`), `${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}`)
      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      // if-match & if-none-match tests
      if (!mockTest && driver.supportsETagMatching) {
        try {
          sampleData = getSampleData();
          await driver.performWrite({
            path: txtFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: sampleData.contentLength,
            ifNoneMatch: '*'
          })
        } catch(err) {
          t.ok(err, 'Should fail to write new file if file already exists')
        }

        try {
          sampleData = getSampleData();
          await driver.performWrite({
            path: txtFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: sampleData.contentLength,
            ifMatch: writeResponse.etag
          })
        } catch(err) {
          t.error(err, 'Should perform write with correct etag')
        }

        try {
          sampleData = getSampleData();
          await driver.performWrite({
            path: txtFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: sampleData.contentLength,
            ifMatch: 'bad-etag'
          })
        } catch(err) {
          t.ok(err, 'Should fail to write with bad etag')
        }
      }

      resp = await fetch(readUrl)
      t.ok(resp.ok, 'fetch should return 2xx OK status code')
      resptxt = await resp.text()
      t.equal(resptxt, sampleDataString, `Must get back ${sampleDataString}: got back: ${resptxt}`)
      if (!mockTest) {
        t.equal(resp.headers.get('content-type'), 'text/plain; charset=utf-8', 'Read-end point response should contain correct content-type')
      }

      files = await driver.listFiles({pathPrefix: topLevelStorage})
      t.equal(files.entries.length, 2, 'Should return two files')
      t.ok(files.entries.includes(txtFileName), `Should include ${txtFileName}`)

      files = await driver.listFiles({pathPrefix: `${Date.now()}r${Math.random()*1e6|0}`})
      t.equal(files.entries.length, 0, 'List files for empty directory should return zero entries')

      files = await driver.listFiles({pathPrefix: `${topLevelStorage}/${txtFileName}`})
      t.equal(files.entries.length, 1, 'List files on a file rather than directory should return a single entry')
      t.equal(files.entries[0], '', 'List files on a file rather than directory should return a single empty entry')
      t.strictEqual(files.page, null, 'List files page result should be null')

      try {
        await driver.performDelete({path: txtFileName, storageTopLevel: topLevelStorage})
        t.pass('Should performDelete on an existing file')

        files = await driver.listFiles({pathPrefix: topLevelStorage})
        t.equal(files.entries.length, 1, 'Should return single file after one was deleted')
        t.ok(!files.entries.includes(txtFileName), `Should not have listed deleted file ${txtFileName}`)

      } catch (error) {
        t.error(error, 'Should performDelete on an existing file')
      }

      try {
        await driver.performDelete({path: txtFileName, storageTopLevel: topLevelStorage})
        t.fail('Should fail to performDelete on non-existent file')
      } catch (error) {
        t.pass('Should fail to performDelete on non-existent file')
        if (!(error instanceof DoesNotExist)) {
          t.equal(error.constructor.name, 'DoesNotExist', 'Should throw DoesNotExist trying to performDelete on non-existent file')
        }
      }

      try {
        await driver.performDelete({path: fileSubDir, storageTopLevel: topLevelStorage})
        t.fail('Should fail to performDelete on a directory')
      } catch (error) {
        t.pass('Should fail to performDelete on a directory')
        if (!(error instanceof DoesNotExist)) {
          t.equal(error.constructor.name, 'DoesNotExist', 'Should throw DoesNotExist trying to performDelete on directory')
        }
      }

      try {
        await driver.performDelete({path: '../foo.js', storageTopLevel: topLevelStorage})
        t.fail('Should have thrown deleting file with invalid path')
      }
      catch (error) {
        t.pass('Should fail to performDelete on invalid path')
        if (!(error instanceof BadPathError)) {
          t.equal(error.constructor.name, 'BadPathError', 'Should throw BadPathError trying to performDelete on directory')
        }
      }

      if (!mockTest) {
        // test file read
        try {
          const readTestFile = 'read_test_file.txt'
          const stream = new PassThrough()
          stream.end('Hello read test!')
          const dateNow1 = Math.round(Date.now() / 1000)
          const writeResult = await driver.performWrite({
            path: readTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          })
          const readResult = await driver.performRead({
            path: readTestFile,
            storageTopLevel: topLevelStorage
          })
          const dataBuffer = await utils.readStream(readResult.data)
          const dataStr = dataBuffer.toString('utf8')
          t.equal(dataStr, 'Hello read test!', 'File read should return data matching the write')
          t.equal(readResult.exists, true, 'File stat should return exists after write')
          t.equal(readResult.contentLength, 16, 'File stat should have correct content length')
          t.equal(readResult.contentType, "text/plain; charset=utf-8", 'File stat should have correct content type')
          t.equal(readResult.etag, writeResult.etag, 'File read should return same etag as write result')
          const dateDiff = Math.abs(readResult.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `File stat last modified date is not within range, diff: ${dateDiff} -- ${readResult.lastModifiedDate} vs ${dateNow1}`)

          const fetchResult = await fetch(writeResult.publicURL)
          t.equal(fetchResult.status, 200, 'Read endpoint HEAD fetch should return 200 OK status code')
          const fetchStr = await fetchResult.text()
          t.equal(fetchStr, 'Hello read test!', 'Read endpoint GET should return data matching the write')
          t.equal(fetchResult.headers.get('content-length'), '16', 'Read endpoint GET should have correct content length header')
          t.equal(fetchResult.headers.get('content-type'), 'text/plain; charset=utf-8', 'Read endpoint GET should have correct content type header')
          t.equal(fetchResult.headers.get('etag'), readResult.etag, 'Read endpoint GET should return same etag as read result')
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(lastModifiedHeader - dateNow1)
          t.equal(dateDiff < 10, true, `Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}`)
        } catch (error) {
          t.error(error, 'Error performing file read test')
        }

        // test file read on non-existent file
        try {
          const nonExistentFile = 'read_none.txt'
          const statResult = await driver.performRead({
            path: nonExistentFile,
            storageTopLevel: topLevelStorage
          })
          t.equal(statResult.exists, false, 'File read should throw not exist')
        } catch (error) {
          t.pass('Should fail to performRead on non-existent file')
          if (!(error instanceof DoesNotExist)) {
            t.equal(error.constructor.name, 'DoesNotExist', 'Should throw DoesNotExist trying to performRead on non-existent file')
          }
        }

        // test file read on invalid path
        try {
          await driver.performRead({path: '../foo.js', storageTopLevel: topLevelStorage})
          t.fail('Should have thrown performing file read with invalid path')
        }
        catch (error) {
          t.pass('Should fail to performStat on invalid path')
          if (!(error instanceof BadPathError)) {
            t.equal(error.constructor.name, 'BadPathError', 'Should throw BadPathError trying to performRead on directory')
          }
        }

        // test file read on subdirectory
        try {
          const result = await driver.performRead({path: fileSubDir, storageTopLevel: topLevelStorage})
          t.equal(result.exists, false, 'performRead on a directory should return not exists')
        } catch (error) {
          t.pass('Should fail to performRead on directory')
          if (!(error instanceof DoesNotExist)) {
            t.equal(error.constructor.name, 'DoesNotExist', 'Should throw DoesNotExist trying to performRead on directory')
          }
        }
      }

      if (!mockTest) {

        // test file stat on listFiles
        try {
          const statTestFile = 'list_stat_test.txt'
          const stream1 = new PassThrough()
          stream1.end('abc sample content 1', 'utf8')
          const dateNow1 = Math.round(Date.now() / 1000)
          const writeResult = await driver.performWrite({
            path: statTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream1,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          })
          const listStatResult = await driver.listFilesStat({
            pathPrefix: topLevelStorage
          })
          const statResult = listStatResult.entries.find(e => e.name.includes(statTestFile))
          t.equal(statResult.exists, true, 'File stat should return exists after write')
          t.equal(statResult.contentLength, 20, 'File stat should have correct content length')
          t.equal(statResult.etag, writeResult.etag, 'File read should return same etag as write file result')
          const dateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `File stat last modified date is not within range, diff: ${dateDiff} -- ${statResult.lastModifiedDate} vs ${dateNow1}`)

          const fetchResult = await fetch(writeResult.publicURL, { method: 'HEAD' })
          t.equal(fetchResult.status, 200, 'Read endpoint HEAD fetch should return 200 OK status code')
          t.equal(fetchResult.headers.get('content-length'), '20', 'Read endpoint HEAD should have correct content length')
          t.equal(fetchResult.headers.get('etag'), statResult.etag, 'Read endpoint HEAD should return same etag as list files stat result')
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}`)
        } catch (error) {
          t.error(error, 'File stat on list files error')
        }

        // test file stat
        try {
          const statTestFile = 'stat_test.txt'
          const stream1 = new PassThrough()
          stream1.end('abc sample content 1', 'utf8')
          const dateNow1 = Math.round(Date.now() / 1000)
          const writeResult = await driver.performWrite({
            path: statTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream1,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          })
          const statResult = await driver.performStat({
            path: statTestFile, 
            storageTopLevel: topLevelStorage
          })

          t.equal(statResult.exists, true, 'File stat should return exists after write')
          t.equal(statResult.contentLength, 20, 'File stat should have correct content length')
          t.equal(statResult.contentType, "text/plain; charset=utf-8", 'File stat should have correct content type')
          t.equal(statResult.etag, writeResult.etag, 'File stat should return same etag as write file result')
          const dateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `File stat last modified date is not within range, diff: ${dateDiff} -- ${statResult.lastModifiedDate} vs ${dateNow1}`)

          const fetchResult = await fetch(writeResult.publicURL, { method: 'HEAD' })
          t.equal(fetchResult.status, 200, 'Read endpoint HEAD fetch should return 200 OK status code')
          t.equal(fetchResult.headers.get('content-length'), '20', 'Read endpoint HEAD should have correct content length')
          t.equal(fetchResult.headers.get('etag'), statResult.etag, 'Read endpoint HEAD should return same etag as stat file result')
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}`)

        } catch (error) {
          t.error(error, 'File stat error')
        }

        // test file stat on non-existent file
        try {
          const nonExistentFile = 'stat_none.txt'
          const statResult = await driver.performStat({
            path: nonExistentFile,
            storageTopLevel: topLevelStorage
          })
          t.equal(statResult.exists, false, 'File stat should return not exist')
        } catch (error) {
          t.error(error, 'File stat non-exists error')
        }

        // test file stat on invalid path
        try {
          await driver.performStat({path: '../foo.js', storageTopLevel: topLevelStorage})
          t.fail('Should have thrown performing file stat with invalid path')
        }
        catch (error) {
          t.pass('Should fail to performStat on invalid path')
          if (!(error instanceof BadPathError)) {
            t.equal(error.constructor.name, 'BadPathError', 'Should throw BadPathError trying to performStat on directory')
          }
        }

        // test file stat on subdirectory
        try {
          const result = await driver.performStat({path: fileSubDir, storageTopLevel: topLevelStorage})
          t.equal(result.exists, false, 'performStat on a directory should return not exists')
        } catch (error) {
          t.error(error, 'File stat directory error')
        }

      }

      if (!mockTest) {
        sampleData = getSampleData();
        const bogusContentType = 'x'.repeat(3000)
        try {
          await driver.performWrite(
            { path: 'bogusContentTypeFile',
              storageTopLevel: topLevelStorage,
              stream: sampleData.stream,
              contentType: bogusContentType,
              contentLength: sampleData.contentLength })
          t.fail('Extremely large content-type headers should fail to write')
        } catch (error) {
          t.pass('Extremely large content-type headers should fail to write')
        }
      }

      try {
        const invalidFileName = `../../your_password`;
        let sampleData = getSampleData();
        await driver.performWrite({
          path: invalidFileName,
          storageTopLevel: topLevelStorage,
          stream: sampleData.stream,
          contentType: 'application/octet-stream',
          contentLength: sampleData.contentLength
        });
        t.fail('File write with a filename containing path traversal should have been rejected')
      } catch (error) {
        t.pass('File write with a filename containing path traversal should have been rejected')
      }

      if (!mockTest) {
        const pageTestDir = 'page_test_dir'
        for (var i = 0; i < 5; i++) {
          const binFileName = `${pageTestDir}/foo_${i}.bin`;
          let sampleData = getSampleData();
          await driver.performWrite({
            path: binFileName,
            storageTopLevel: topLevelStorage,
            stream: sampleData.stream,
            contentType: 'application/octet-stream',
            contentLength: sampleData.contentLength
          });
        }
        const pagedFiles = await driver.listFiles({pathPrefix: `${topLevelStorage}/${pageTestDir}`})
        t.equal(pagedFiles.entries.length, 3, 'List files with no pagination and maxPage size specified should have returned 3 entries')
        const remainingFiles = await driver.listFiles({pathPrefix: `${topLevelStorage}/${pageTestDir}`, page: pagedFiles.page})
        t.equal(remainingFiles.entries.length, 2, 'List files with pagination should have returned 2 remaining entries')

        try {
          const bogusPageResult = await driver.listFiles({pathPrefix: `${topLevelStorage}/${pageTestDir}`, page: "bogus page data"})
          if (bogusPageResult.entries.length > 0) {
            t.fail('List files with invalid page data should fail or return no results')
          }
          t.pass('List files with invalid page data should fail or return no results')
        } catch (error) {
          t.pass('List files with invalid page data should have failed')
        }

        // test file renames
        try {
          const renameTestFile1a = 'renamable1a.txt'

          const stream1 = new PassThrough()
          stream1.end('abc sample content 1', 'utf8')

          await driver.performWrite({
            path: renameTestFile1a,
            storageTopLevel: topLevelStorage,
            stream: stream1,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          });

          const dateNow1 = Math.round(Date.now() / 1000)
          const renameTestFile2b = 'renamable2b.txt'
          await driver.performRename({
            path: renameTestFile1a,
            storageTopLevel: topLevelStorage,
            newPath: renameTestFile2b
          })

          // test that the renamed file has the properties of the original file
          const renamedFileRead = await driver.performRead({
            path: renameTestFile2b,
            storageTopLevel: topLevelStorage
          })
          const renamedFileContent = (await utils.readStream(renamedFileRead.data)).toString('utf8')
          t.equal(renamedFileContent, 'abc sample content 1')
          t.equal(renamedFileRead.exists, true, 'File stat should return exists after write')
          t.equal(renamedFileRead.contentLength, 20, 'File stat should have correct content length')
          t.equal(renamedFileRead.contentType, "text/plain; charset=utf-8", 'File stat should have correct content type')
          const dateDiff = Math.abs(renamedFileRead.lastModifiedDate - dateNow1)
          t.equal(dateDiff < 10, true, `File stat last modified date is not within range, diff: ${dateDiff} -- ${renamedFileRead.lastModifiedDate} vs ${dateNow1}`)

          // test that the original file is reported as deleted
          const movedFileStat = await driver.performStat({path: renameTestFile1a, storageTopLevel: topLevelStorage})
          t.equal(movedFileStat.exists, false, 'Renamed file original path should report as non-existent')

        } catch (error) {
          t.error(error, `File rename error`)
        }

        // test invalid file rename
        try {
          await driver.performRename({
            path: 'does-not-exist-rename.txt',
            storageTopLevel: topLevelStorage,
            newPath: 'new-location.txt'
          })
          t.fail('File rename for non-existent file should have thrown')
        } catch(error) {
          if (error instanceof DoesNotExist) {
            t.pass('Rename of non-existent file resulted in DoesNotExist')
          } else {
            t.error(error, 'Unexpected error during rename of non-existent file')
          }
        }

        // test file renames with invalid original path
        try {
          await driver.performRename({
            path: '../foo.js', 
            storageTopLevel: topLevelStorage,
            newPath: 'new-location.txt'
          })
          t.fail('Should have thrown performing file rename with invalid original path')
        }
        catch (error) {
          t.pass('Should fail to performRename on invalid original path')
          if (!(error instanceof BadPathError)) {
            t.equal(error.constructor.name, 'BadPathError', 'Should throw BadPathError trying to performRename on invalid original path')
          }
        }
        
        // test file renames with invalid target path
        try {
          await driver.performRename({
            path: 'some-file.txt', 
            storageTopLevel: topLevelStorage,
            newPath: '../foo.js'
          })
          t.fail('Should have thrown performing file rename with invalid new path')
        }
        catch (error) {
          t.pass('Should fail to performRename on invalid new path')
          if (!(error instanceof BadPathError)) {
            t.equal(error.constructor.name, 'BadPathError', 'Should throw BadPathError trying to performRename on invalid new path')
          }
        }

        // test file renames with subdirectories
        try {
          await driver.performRename({
            path: fileSubDir, 
            storageTopLevel: topLevelStorage,
            newPath: 'some-file-from-dir.txt'
          })
          t.fail('Should have thrown performing file rename with sub-directory as original path')
        }
        catch (error) {
          t.pass('Should fail to performRename on sub-directory as original path')
          if (!(error instanceof DoesNotExist)) {
            t.equal(error.constructor.name, 'DoesNotExist', 'Should throw DoesNotExist trying to performRename on sub-directory as new path')
          }
        }

        // test concurrent writes to same file
        try {
          const concurrentTestFile = 'concurrent_file_test'

          const stream1 = new PassThrough()
          stream1.write('abc sample content 1', 'utf8')

          const writeRequest1 = driver.performWrite({
            path: concurrentTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream1,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          });

          const stream2 = new PassThrough()
          stream2.write('xyz sample content 2', 'utf8')

          await utils.timeout(1)
          const writeRequest2 = driver.performWrite({
            path: concurrentTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream2,
            contentType: 'text/plain; charset=utf-8',
            contentLength: 100
          })
          await utils.timeout(10)
          stream1.end()
          await utils.timeout(10)
          stream2.end()
          const [ writeResponse ] = await Promise.all([writeRequest1, writeRequest2])
          const readEndpoint = writeResponse.publicURL
          resp = await fetch(readEndpoint)
          resptxt = await resp.text()
          if (resptxt === 'xyz sample content 2' || resptxt === 'abc sample content 1') {
            t.ok(resptxt, 'Concurrent writes resulted in conflict resolution at the storage provider')
          } else {
            t.fail(`Concurrent writes resulted in mangled data: ${resptxt}`)
          }
        } catch (error) {
          if (error instanceof ConflictError) {
            t.pass('Concurrent writes resulted in ConflictError')
          } else {
            t.error(error, 'Unexpected error during concurrent writes')
          }
        }

        try {
          const brokenUploadStream = new BrokenReadableStream()
          await driver.performWrite({
            path: 'broken_upload_stream_test',
            storageTopLevel: topLevelStorage,
            stream: brokenUploadStream,
            contentType: 'application/octet-stream',
            contentLength: 100
          });
          t.fail('Perform write with broken upload stream should have failed')
        } catch (error) {
          t.pass('Perform write with broken upload stream should have failed')
        }
        
      }

      if (mockTest) {
        fetch.restore()
      }
    }
    finally {
      await driver.dispose();
    }

  });
}

function testDriverBucketCreation(driverName: string, createDriver: (config?: Object) => DriverModelTestMethods) {

  test(`bucket creation for driver: ${driverName}`, async (t) => {
    const topLevelStorage = `test-buckets-creation${Date.now()}r${Math.random()*1e6|0}`
    const driver = createDriver({ bucket: topLevelStorage })
    try {
      await driver.ensureInitialized()
      t.pass('Successfully initialized driver with creation of a new bucket')
    } catch (error) {
      t.fail(`Could not initialize driver with creation of a new bucket: ${error}`)
    } finally {
      try {
        await driver.deleteEmptyBucket()
      } catch (error) {
        t.fail(`Error trying to cleanup bucket: ${error}`)
      }
      await driver.dispose()
    }
  })
}

/** 
 * Readable stream that simulates an interrupted http upload/POST request.
 * Outputs some data then errors unexpectedly .
 */
class BrokenReadableStream extends Readable {
  readCount: number
  sampleData: Buffer
  constructor(options?: any) {
    super(options)
    this.readCount = 0
    this.sampleData = Buffer.from('hello world sample data')
  }
  _read(size: number): void {
    if (this.readCount === 0) {
      super.push(this.sampleData)
    } else if (this.readCount === 1) {
      // cause the stream to break/error
      super.destroy(new Error('example stream read failure'))
    }
    this.readCount++
  }
}

function performDriverMockTests() {
  for (const name in mockTestDrivers.availableMockedDrivers) {
    const testName = `mock test for driver: ${name}`
    const mockTest = true
    const { driverClass, dataMap, config } = mockTestDrivers.availableMockedDrivers[name]();
    testDriver(testName, mockTest, dataMap, testConfig => new driverClass({...config, ...testConfig}))
  }
}

function performDriverIntegrationTests() {
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const testName = `integration test for driver: ${name}`
    const mockTest = false
    testDriver(testName, mockTest, [], testConfig => driverInfo.create(testConfig))
  }
}

function performDriverBucketCreationTests() {
  // Test driver initialization that require the creation of a new bucket,
  // only on configured driver that implement the `deleteEmptyBucket` method
  // so as not to exceed cloud provider max bucket/container limits.
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const classPrototype: any = driverInfo.class.prototype
    if (classPrototype.deleteEmptyBucket) {
      testDriverBucketCreation(name, testConfig => <any>driverInfo.create(testConfig)) 
    }
  }
}

export function testDrivers() {
  performDriverMockTests()
  performDriverIntegrationTests()
  performDriverBucketCreationTests()
}
