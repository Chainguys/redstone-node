import { BaseFetcher } from "../BaseFetcher";
import { PricesObj } from "../../types";
import redstone from "redstone-api";
import ccxt, { Exchange, ExchangeId, Ticker } from "ccxt";

const CCXT_FETCHER_MAX_REQUEST_TIMEOUT_MS = 120000;

export class CcxtFetcher extends BaseFetcher {
  private readonly exchange: Exchange;
  private lastUsdtPrice?: number;

  // CCXT-based fetchers must have names that are exactly equal to
  // the appropriate exchange id in CCXT
  // List of ccxt exchanges: https://github.com/ccxt/ccxt/wiki/Exchange-Markets
  constructor(name: ExchangeId) {
    super(name);
    this.exchange = new (ccxt as any)[name]({
      timeout: CCXT_FETCHER_MAX_REQUEST_TIMEOUT_MS,
      enableRateLimit: false, // This config option is required to avoid problems with requests timeout
    }) as Exchange;
  }

  async prepareForFetching() {
    const price = await redstone.getPrice("USDT");
    this.lastUsdtPrice = price.value;
  }

  async fetchData(): Promise<any> {
    if (!this.exchange.has["fetchTickers"]) {
      throw new Error(
        `Exchange ${this.name} doesn't support fetchTickers method`);
    }

    return await this.exchange.fetchTickers();
  }

  extractPrices(response: any): PricesObj {
    const pricesObj: PricesObj = {};
    for (const ticker of Object.values(response) as Ticker[]) {
      const pairSymbol = ticker.symbol;
      const lastPrice = ticker.last as number;

      if (pairSymbol.endsWith("/USD")) {
        const symbol = pairSymbol.replace("/USD", "");
        pricesObj[symbol] = lastPrice;
      } else if (pairSymbol.endsWith("/USDT")) {
        const symbol = pairSymbol.replace("/USDT", "");
        if (!pricesObj[symbol]) {
          pricesObj[symbol] = lastPrice * this.lastUsdtPrice!;
        }
      }
    }

    return pricesObj;
  }
};
