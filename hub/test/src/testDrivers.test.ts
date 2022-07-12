import fetchMock from 'fetch-mock'
import NodeFetch from 'node-fetch'

import { Readable, PassThrough, ReadableOptions } from 'stream'
import { DriverModel, DriverModelTestMethods } from '../../src/server/driverModel.js'
import * as utils from '../../src/server/utils.js'

import * as mockTestDrivers from './testDrivers/mockTestDrivers.js'
import * as integrationTestDrivers from './testDrivers/integrationTestDrivers.js'
import { BadPathError, DoesNotExist, ConflictError } from '../../src/server/errors.js'
import { tryFor } from '../../src/server/utils.js'

export function addMockFetches(fetchLib: fetchMock.FetchMockSandbox, prefix: any, dataMap: {key: string, data: string}[]) {
  dataMap.forEach(item => {
    fetchLib.get(`${prefix}${item.key}`, item.data, { overwriteRoutes: true })
  })
}


function testDriver(testName: string, mockTest: boolean, dataMap: {key: string, data: string}[], createDriver: (config?: any) => DriverModel) {

  test(testName, async () => {
    const topLevelStorage = `${Date.now()}r${Math.random()*1e6|0}`
    const cacheControlOpt = 'no-cache, no-store, must-revalidate'
    const driver = createDriver({
      pageSize: 3,
      cacheControl: cacheControlOpt
    })
    try {
      if (mockTest) {
        expect.assertions(21)
      } else {
        // TODO: count the test cases
        // expect.assertions(<test count>)
      }

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

      const fetch = (mockTest ? fetchMock.sandbox() : NodeFetch) as fetchMock.FetchMockSandbox

      try {
        const writeArgs : any = { path: '../foo.js'}
        await driver.performWrite(writeArgs)
      }
      catch (err) {
        // Should throw bad path
        expect(err.message).toEqual('Invalid Path')
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
      // ${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}
      expect(readUrl.startsWith(`${prefix}${topLevelStorage}`)).toBeTruthy()

      if (mockTest) {
        addMockFetches(fetch, prefix, dataMap)
      }

      let resp = await fetch(readUrl)
      // fetch should return 2xx OK status code
      expect(resp.ok).toBeTruthy()
      let resptxt = await resp.text()
      // Must get back ${sampleDataString}: got back: ${resptxt}
      expect(resptxt).toEqual(sampleDataString)
      if (!mockTest) {
        // Read endpoint response should contain correct content-type
        expect(resp.headers.get('content-type')).toEqual('application/octet-stream')
        // Read endpoint should contain correct etag
        expect(resp.headers.get('etag')).toEqual(writeResponse.etag)
        // cacheControl not respected in response headers
        expect(resp.headers.get('cache-control')).toEqual(cacheControlOpt)
      }

      let files = await driver.listFiles({pathPrefix: topLevelStorage})
      // Should return one file
      expect(files.entries.length).toEqual(1)
      // Should be ${binFileName}!
      expect(files.entries[0]).toEqual(binFileName)
      // list files for 1 result should not have returned a page
      expect(!files.page).toBeTruthy()

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
      // ${readUrl} must start with readUrlPrefix ${prefix}${topLevelStorage}
      expect(readUrl.startsWith(`${prefix}${topLevelStorage}`)).toBeTruthy()
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
          if (err.name === 'PreconditionFailedError') {
            // Should fail to write new file if file already exists
            expect(err).toBeTruthy()
          } else {
            // Should throw PreconditionFailedError
            expect(err).toBeFalsy()
          }
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
          // Should perform write with correct etag
          expect(err).toBeFalsy()
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
          // Should fail to write with bad etag
          expect(err).toBeTruthy()
        }
      }

      resp = await fetch(readUrl)
      // fetch should return 2xx OK status code
      expect(resp.ok).toBeTruthy()
      resptxt = await resp.text()
      // Must get back ${sampleDataString}: got back: ${resptxt}
      expect(resptxt).toEqual(sampleDataString)
      if (!mockTest) {
        // Read-end point response should contain correct content-type
        expect(resp.headers.get('content-type')).toEqual('text/plain; charset=utf-8')
      }

      files = await driver.listFiles({pathPrefix: topLevelStorage})
      // Should return two files
      expect(files.entries.length).toEqual(2)
      // Should include ${txtFileName}
      expect(files.entries.includes(txtFileName)).toBeTruthy()

      files = await driver.listFiles({pathPrefix: `${Date.now()}r${Math.random()*1e6|0}`})
      // List files for empty directory should return zero entries
      expect(files.entries.length).toEqual(0)

      files = await driver.listFiles({pathPrefix: `${topLevelStorage}/${txtFileName}`})
      // List files on a file rather than directory should return a single entry
      expect(files.entries.length).toEqual(1)
      // List files on a file rather than directory should return a single empty entry
      expect(files.entries[0]).toEqual('')
      // List files page result should be null
      expect(files.page).toStrictEqual(null)

      try {
        // Should performDelete on an existing file
        await driver.performDelete({path: txtFileName, storageTopLevel: topLevelStorage})

        files = await driver.listFiles({pathPrefix: topLevelStorage})
        // Should return single file after one was deleted
        expect(files.entries.length).toEqual(1)
        // Should not have listed deleted file ${txtFileName}
        expect(!files.entries.includes(txtFileName)).toBeTruthy()

      } catch (error) {
        // Should performDelete on an existing file
        expect(error).toBeFalsy()
      }

      try {
        await driver.performDelete({path: txtFileName, storageTopLevel: topLevelStorage})
        // Should fail to performDelete on non-existent file
      } catch (error) {
        // Should fail to performDelete on non-existent file
        // Should throw DoesNotExist trying to performDelete on non-existent file
        expect(error.constructor.name).toEqual('DoesNotExist')
      }

      try {
        await driver.performDelete({path: fileSubDir, storageTopLevel: topLevelStorage})
        // Should fail to performDelete on a directory
      } catch (error) {
        // Should fail to performDelete on a directory
        // Should throw DoesNotExist trying to performDelete on directory
        expect(error.constructor.name).toEqual('DoesNotExist')
      }

      try {
        await driver.performDelete({path: '../foo.js', storageTopLevel: topLevelStorage})
        // Should have thrown deleting file with invalid path
      }
      catch (error) {
        // Should fail to performDelete on invalid path
        // Should throw BadPathError trying to performDelete on directory
        expect(error.constructor.name).toEqual('BadPathError')
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
          // File read should return data matching the write
          expect(dataStr).toEqual('Hello read test!')
          // File stat should return exists after write
          expect(readResult.exists).toEqual(true)
          // File stat should have correct content length
          expect(readResult.contentLength).toEqual(16)
          // File stat should have correct content type
          expect(readResult.contentType).toEqual('text/plain; charset=utf-8')
          // File read should return same etag as write result
          expect(readResult.etag).toEqual(writeResult.etag)
          const dateDiff = Math.abs(readResult.lastModifiedDate - dateNow1)
          // File stat last modified date is not within range, diff: ${dateDiff} -- ${readResult.lastModifiedDate} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)

          const fetchResult = await fetch(writeResult.publicURL)
          // Read endpoint HEAD fetch should return 200 OK status code
          expect(fetchResult.status).toEqual(200)
          const fetchStr = await fetchResult.text()
          // Read endpoint GET should return data matching the write
          expect(fetchStr).toEqual('Hello read test!')
          // Read endpoint GET should have correct content length header
          expect(fetchResult.headers.get('content-length')).toEqual('16')
          // Read endpoint GET should have correct content type header
          expect(fetchResult.headers.get('content-type')).toEqual('text/plain; charset=utf-8')
          // Read endpoint GET should return same etag as read result
          expect(fetchResult.headers.get('etag')).toEqual(readResult.etag)
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(lastModifiedHeader - dateNow1)
          // Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)
        } catch (error) {
          // Error performing file read test
          expect(error).toBeFalsy()
        }

        // test file read on non-existent file
        try {
          const nonExistentFile = 'read_none.txt'
          const statResult = await driver.performRead({
            path: nonExistentFile,
            storageTopLevel: topLevelStorage
          })
          // File read should throw not exist
          expect(statResult.exists).toEqual(false)
        } catch (error) {
          // Should fail to performRead on non-existent file
          // Should throw DoesNotExist trying to performRead on non-existent file
          expect(error.constructor.name).toEqual('DoesNotExist')
        }

        // test file read on invalid path
        try {
          await driver.performRead({path: '../foo.js', storageTopLevel: topLevelStorage})
          // Should have thrown performing file read with invalid path
        }
        catch (error) {
          // Should fail to performStat on invalid path
          // Should throw BadPathError trying to performRead on directory
          expect(error.constructor.name).toEqual('BadPathError')
        }

        // test file read on subdirectory
        try {
          const result = await driver.performRead({path: fileSubDir, storageTopLevel: topLevelStorage})
          // performRead on a directory should return not exists
          expect(result.exists).toEqual(false)
        } catch (error) {
          // Should fail to performRead on directory
          // Should throw DoesNotExist trying to performRead on directory
          expect(error.constructor.name).toEqual('DoesNotExist')
        }

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
          // File stat should return exists after write
          expect(statResult.exists).toEqual(true)
          // File stat should have correct content length
          expect(statResult.contentLength).toEqual(20)
          // File read should return same etag as write file result
          expect(statResult.etag).toEqual(writeResult.etag)
          const dateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          // File stat last modified date is not within range, diff: ${dateDiff} -- ${statResult.lastModifiedDate} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)

          const fetchResult = await fetch(writeResult.publicURL, { method: 'HEAD' })
          // Read endpoint HEAD fetch should return 200 OK status code
          expect(fetchResult.status).toEqual(200)
          // Read endpoint HEAD should have correct content length
          expect(fetchResult.headers.get('content-length')).toEqual('20')
          // Read endpoint HEAD should return same etag as list files stat result
          expect(fetchResult.headers.get('etag')).toEqual(statResult.etag)
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          // Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)
        } catch (error) {
          // File stat on list files error
          expect(error).toBeFalsy()
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

          // File stat should return exists after write
          expect(statResult.exists).toEqual(true)
          // File stat should have correct content length
          expect(statResult.contentLength).toEqual(20)
          // File stat should have correct content type
          expect(statResult.contentType).toEqual('text/plain; charset=utf-8')
          // File stat should return same etag as write file result
          expect(statResult.etag).toEqual(writeResult.etag)
          const dateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          // File stat last modified date is not within range, diff: ${dateDiff} -- ${statResult.lastModifiedDate} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)

          const fetchResult = await fetch(writeResult.publicURL, { method: 'HEAD' })
          // Read endpoint HEAD fetch should return 200 OK status code
          expect(fetchResult.status).toEqual(200)
          // Read endpoint HEAD should have correct content length
          expect(fetchResult.headers.get('content-length')).toEqual('20')
          // Read endpoint HEAD should return same etag as stat file result
          expect(fetchResult.headers.get('etag')).toEqual(statResult.etag)
          const lastModifiedHeader = new Date(fetchResult.headers.get('last-modified')).getTime()
          const fetchDateDiff = Math.abs(statResult.lastModifiedDate - dateNow1)
          // Read endpoint HEAD last-modified header is not within range, diff: ${fetchDateDiff} -- ${lastModifiedHeader} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)

        } catch (error) {
          // File stat error
          expect(error).toBeFalsy()
        }

        // test file stat on non-existent file
        try {
          const nonExistentFile = 'stat_none.txt'
          const statResult = await driver.performStat({
            path: nonExistentFile,
            storageTopLevel: topLevelStorage
          })
          // File stat should return not exist
          expect(statResult.exists).toEqual(false)
        } catch (error) {
          // File stat non-exists error
          expect(error).toBeFalsy()
        }

        // test file stat on invalid path
        try {
          await driver.performStat({path: '../foo.js', storageTopLevel: topLevelStorage})
          // Should have thrown performing file stat with invalid path=
        }
        catch (error) {
          // Should fail to performStat on invalid path
          // Should throw BadPathError trying to performStat on directory
          expect(error.constructor.name).toEqual('BadPathError')
        }

        // test file stat on subdirectory
        try {
          const result = await driver.performStat({path: fileSubDir, storageTopLevel: topLevelStorage})
          // performStat on a directory should return not exists
          expect(result.exists).toEqual(false)
        } catch (error) {
          // File stat directory error
          expect(error).toBeFalsy()
        }

        sampleData = getSampleData();
        const bogusContentType = 'x'.repeat(3000)
        try {
          await driver.performWrite(
            { path: 'bogusContentTypeFile',
              storageTopLevel: topLevelStorage,
              stream: sampleData.stream,
              contentType: bogusContentType,
              contentLength: sampleData.contentLength })
          // Extremely large content-type headers should fail to write
        } catch (error) {
          // Extremely large content-type headers should fail to write
        }

        // test file write without content-length
        const zeroByteTestFile = 'zero_bytes.txt'
        const stream = new PassThrough()
        stream.end(Buffer.alloc(0));
        await driver.performWrite({
          path: zeroByteTestFile,
          storageTopLevel: topLevelStorage,
          stream: stream,
          contentType: 'text/plain; charset=utf-8',
          contentLength: undefined
        })

        // test zero-byte file read result
        const readResult = await driver.performRead({
          path: zeroByteTestFile,
          storageTopLevel: topLevelStorage
        })
        // Zero bytes file write should result in read content-length of 0
        expect(readResult.contentLength).toEqual(0)
        const dataBuffer = await utils.readStream(readResult.data)
        // Zero bytes file write should result in read of zero bytes
        expect(dataBuffer.length).toEqual(0)

        // test zero-byte file stat result
        const statResult = await driver.performStat({
          path: zeroByteTestFile,
          storageTopLevel: topLevelStorage
        })
        // Zero bytes file write should result in stat result content-length of 0
        expect(statResult.contentLength).toEqual(0)

        // test zero-byte file list stat result
        const statFilesResult = await driver.listFilesStat({
          pathPrefix: topLevelStorage,
          pageSize: 1000
        })
        const statFile = statFilesResult.entries.find(f => f.name.includes(zeroByteTestFile))
        // Zero bytes file write should result in list file stat content-length 0
        expect(statFile.contentLength).toEqual(0)
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
        // File write with a filename containing path traversal should have been rejected
      } catch (error) {
        // File write with a filename containing path traversal should have been rejected
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
        // List files with no pagination and maxPage size specified should have returned 3 entries
        expect(pagedFiles.entries.length).toEqual(3)
        const remainingFiles = await driver.listFiles({pathPrefix: `${topLevelStorage}/${pageTestDir}`, page: pagedFiles.page})
        // List files with pagination should have returned 2 remaining entries
        expect(remainingFiles.entries.length).toEqual(2)

        try {
          const bogusPageResult = await driver.listFiles({pathPrefix: `${topLevelStorage}/${pageTestDir}`, page: "bogus page data"})
          if (bogusPageResult.entries.length > 0) {
            // List files with invalid page data should fail or return no results
          }
          // List files with invalid page data should fail or return no results
        } catch (error) {
          // List files with invalid page data should have failed
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
          expect(renamedFileContent).toEqual('abc sample content 1')
          // File stat should return exists after write
          expect(renamedFileRead.exists).toEqual(true)
          // File stat should have correct content length
          expect(renamedFileRead.contentLength).toEqual(20)
          // File stat should have correct content type
          expect(renamedFileRead.contentType).toEqual('text/plain; charset=utf-8')
          const dateDiff = Math.abs(renamedFileRead.lastModifiedDate - dateNow1)
          // File stat last modified date is not within range, diff: ${dateDiff} -- ${renamedFileRead.lastModifiedDate} vs ${dateNow1}
          expect(dateDiff < 10).toEqual(true)

          // test that the original file is reported as deleted
          const movedFileStat = await driver.performStat({path: renameTestFile1a, storageTopLevel: topLevelStorage})
          // Renamed file original path should report as non-existent
          expect(movedFileStat.exists).toEqual(false)

        } catch (error) {
          // File rename error
          expect(error).toBeFalsy()
        }

        // test invalid file rename
        try {
          await driver.performRename({
            path: 'does-not-exist-rename.txt',
            storageTopLevel: topLevelStorage,
            newPath: 'new-location.txt'
          })
          // File rename for non-existent file should have thrown
        } catch(error) {
          if (error instanceof DoesNotExist) {
            // Rename of non-existent file resulted in DoesNotExist
          } else {
            // Unexpected error during rename of non-existent file
            expect(error).toBeFalsy()
          }
        }

        // test file renames with invalid original path
        try {
          await driver.performRename({
            path: '../foo.js',
            storageTopLevel: topLevelStorage,
            newPath: 'new-location.txt'
          })
          // Should have thrown performing file rename with invalid original path
        }
        catch (error) {
          // Should fail to performRename on invalid original path
          // Should throw BadPathError trying to performRename on invalid original path
          expect(error.constructor.name).toEqual('BadPathError')
        }

        // test file renames with invalid target path
        try {
          await driver.performRename({
            path: 'some-file.txt',
            storageTopLevel: topLevelStorage,
            newPath: '../foo.js'
          })
          // Should have thrown performing file rename with invalid new path
        }
        catch (error) {
          // Should fail to performRename on invalid new path
          // Should throw BadPathError trying to performRename on invalid new path
          expect(error.constructor.name).toEqual('BadPathError')
        }

        // test file renames with subdirectories
        try {
          await driver.performRename({
            path: fileSubDir,
            storageTopLevel: topLevelStorage,
            newPath: 'some-file-from-dir.txt'
          })
          // Should have thrown performing file rename with sub-directory as original path
        }
        catch (error) {
          // Should fail to performRename on sub-directory as original path
          // Should throw DoesNotExist trying to performRename on sub-directory as new path
          expect(error.constructor.name).toEqual('DoesNotExist')
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
            contentLength: stream1.readableLength
          })

          const stream2 = new PassThrough()
          stream2.write('xyz sample content 2', 'utf8')

          await utils.timeout(100)
          const writeRequest2 = driver.performWrite({
            path: concurrentTestFile,
            storageTopLevel: topLevelStorage,
            stream: stream2,
            contentType: 'text/plain; charset=utf-8',
            contentLength: stream1.readableLength
          })

          const writePromises = Promise.all([
            writeRequest1.catch(() => {
              // ignore
            }),
            writeRequest2.catch(() => {
              // ignore
            })
          ])

          await utils.timeout(100)
          stream1.end()
          await utils.timeout(100)
          stream2.end()

          await writePromises

          const [ writeResponse ] = await Promise.all([writeRequest1, writeRequest2])
          const readEndpoint = writeResponse.publicURL
          resp = await fetch(readEndpoint)
          resptxt = await resp.text()
          if (resptxt === 'xyz sample content 2' || resptxt === 'abc sample content 1') {
            // Concurrent writes resulted in conflict resolution at the storage provider
            expect(resptxt).toBeTruthy()
          } else {
            // Concurrent writes resulted in mangled data: ${resptxt}
          }
        } catch (error) {
          if (error instanceof ConflictError) {
            // Concurrent writes resulted in ConflictError
          } else {
            // Unexpected error during concurrent writes
            expect(error).toBeFalsy()
          }
        }

        try {
          const brokenUploadStream = new BrokenReadableStream({autoDestroy: true})
          await driver.performWrite({
            path: 'broken_upload_stream_test',
            storageTopLevel: topLevelStorage,
            stream: brokenUploadStream,
            contentType: 'application/octet-stream',
            contentLength: 100
          });
          // Perform write with broken upload stream should have failed
        } catch (error) {
          // Perform write with broken upload stream should have failed
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

  test(`bucket creation for driver: ${driverName}`, async () => {
    const topLevelStorage = `test-buckets-creation${Date.now()}r${Math.random()*1e6|0}`
    const driver = createDriver({ bucket: topLevelStorage })
    try {
      await driver.ensureInitialized()
      // Successfully initialized driver with creation of a new bucket
    } catch (error) {
      // Could not initialize driver with creation of a new bucket: ${error}
    } finally {
      try {
        await tryFor(() => driver.deleteEmptyBucket(), 100, 1500)
      } catch (error) {
        // Error trying to cleanup bucket: ${error}
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
  constructor(options?: ReadableOptions) {
    super(options)
    this.readCount = 0
    this.sampleData = Buffer.from('hello world sample data')
  }
  _read(size: number): void {
    if (this.readCount === 0) {
      super.push(this.sampleData)
    } else if (this.readCount === 1) {
      super.emit('error', new Error('example stream read failure'))
      super.emit('close')
    }
    this.readCount++
  }
}


jest.mock('@azure/storage-blob')
jest.mock('aws-sdk/clients/s3')
jest.mock('@google-cloud/storage')


describe('perform driver mock tests', () => {
  let testData = []
  for (const name in mockTestDrivers.availableMockedDrivers) {
    const testName = `mock test for driver: ${name}`
    const mockTest = true
    const { driverClass, dataMap, config } = mockTestDrivers.availableMockedDrivers[name]();
    testDriver(testName, mockTest, dataMap, testConfig => new driverClass({...config, ...testConfig}))
  }
})


describe('perform driver integration tests', () => {
  for (const name in integrationTestDrivers.availableDrivers) {
    const driverInfo = integrationTestDrivers.availableDrivers[name];
    const testName = `integration test for driver: ${name}`
    const mockTest = false
    testDriver(testName, mockTest, [], testConfig => driverInfo.create(testConfig))
  }
})


describe('perform driver bucket creation test', () => {
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
})
