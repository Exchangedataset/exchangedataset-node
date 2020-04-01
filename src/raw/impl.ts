/**
 * @internal
 * @packageDocumentation
 */

import { RawRequest, RawRequestParam } from "./raw";
import { Line } from "../common/line";
import { Filter, checkParamFilter } from "../common/param";
import { ClientSetting } from "../client/impl";
import { convertDatetimeParam } from "../utils/datetime";
import download from "./download";
import RawStreamIterator from './iterator';

export type RawRequestSetting = {
  filter: Filter;
  start: bigint;
  end: bigint;
  format: "raw" | "csvlike";
}

export function setupRawRequestSetting(param: RawRequestParam): RawRequestSetting {
  if (!('start' in param)) throw new Error('"start" date time was not specified');
  if (!('end' in param)) throw new Error('"end" date time was not specified');
  checkParamFilter(param);
  if (!('format' in param)) throw new Error('"format" was not specified');
  if (typeof param.format !== 'string') throw new Error('"format" must be of string type');

  const start = convertDatetimeParam(param.start);
  let end = convertDatetimeParam(param.end);
  if (typeof param.end === 'number') {
    end += BigInt('60') * BigInt('1000000000');
  }

  if (end <= start) {
    throw new Error('Invalid date time range "end" <= "start"');
  }

  const filter = JSON.parse(JSON.stringify(param.filter));

  return {
    filter,
    start,
    end,
    format: param.format,
  };
}

export class RawRequestImpl implements RawRequest {
  constructor(private clientSetting: ClientSetting, private setting: RawRequestSetting) {}

  async download(): Promise<Line[]> {
    return download(this.clientSetting, this.setting);
  }
  stream(bufferSize?: number): AsyncIterable<Line> {
    const clientSetting = this.clientSetting;
    const setting = this.setting;
    return {
      [Symbol.asyncIterator](): AsyncIterator<Line> {
        return new RawStreamIterator(clientSetting, setting, bufferSize);
      },
    }
  }
}