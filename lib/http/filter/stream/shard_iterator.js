"use strict";
/**
 * @internal
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../../constants");
const datetime_1 = require("../../../utils/datetime");
const common_1 = require("../common");
class FilterStreamShardIterator {
    constructor(clientSetting, setting, bufferSize = constants_1.FILTER_DEFAULT_BUFFER_SIZE) {
        this.clientSetting = clientSetting;
        this.setting = setting;
        // fill buffer with null value (means not downloaded)
        this.buffer = [];
        this.notifier = null;
        this.error = null;
        this.nextDownloadMinute = datetime_1.convertNanosecToMinute(setting.start);
        this.endMinute = datetime_1.convertNanosecToMinute(setting.end);
        // start downloading shards to fill buffer
        for (let i = 0; i < bufferSize && this.nextDownloadMinute <= this.endMinute; i += 1)
            this.downloadNewShard();
    }
    downloadNewShard() {
        // push empty slot to represent shard downloading
        const slot = {};
        this.buffer.push(slot);
        common_1.downloadFilterShard(this.clientSetting, this.setting.exchange, this.setting.channels, this.setting.start, this.setting.end, this.nextDownloadMinute).then((shard) => {
            // once downloaded, set instance of shard
            slot.shard = shard;
            if (this.notifier !== null) {
                // call notifier to let promise in wait for downloading know
                this.notifier();
            }
        }).catch((err) => {
            if (this.notifier === null) {
                this.error = err;
            }
            else {
                // notify error
                this.notifier(err);
            }
        });
        this.nextDownloadMinute += 1;
    }
    ;
    async next() {
        // if error during download was not handled, reject this promise to let others know
        if (this.error)
            throw this.error;
        if (this.buffer.length === 0) {
            return {
                done: true,
                value: null,
            };
        }
        // there is always the first element in buffer
        if (typeof this.buffer[0].shard === 'undefined') {
            // shard is being downloaded, wait for it
            return new Promise((resolve, reject) => {
                // this is in promise callback, it will be called later
                // there might be shard already, check for that
                if (typeof this.buffer[0].shard === 'undefined') {
                    this.notifier = (err) => {
                        // download error, reject with it
                        if (err)
                            reject(err);
                        if (typeof this.buffer[0].shard === 'undefined') {
                            // the first element is still not downloaded
                            // wait more
                            return;
                        }
                        const { shard } = this.buffer[0];
                        this.buffer.shift();
                        if (this.nextDownloadMinute <= this.endMinute)
                            this.downloadNewShard();
                        resolve({
                            done: false,
                            value: shard,
                        });
                        // deregister this notifier
                        this.notifier = null;
                    };
                }
                else {
                    const { shard } = this.buffer[0];
                    this.buffer.shift();
                    if (this.nextDownloadMinute <= this.endMinute)
                        this.downloadNewShard();
                    resolve({
                        done: false,
                        value: shard,
                    });
                }
            });
        }
        // shard is bufferred, return it
        const { shard } = this.buffer[0];
        this.buffer.shift();
        if (this.nextDownloadMinute <= this.endMinute)
            this.downloadNewShard();
        return Promise.resolve({
            done: false,
            value: shard,
        });
    }
}
exports.default = FilterStreamShardIterator;