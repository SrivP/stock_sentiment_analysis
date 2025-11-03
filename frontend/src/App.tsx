import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import axios from "axios";
import { useState, useEffect } from "react";

interface HistoricalData {
  date: string;
  close: number | null;
  ma5: number | null;
  predicted_close: number | null;
}

interface StockData {
  symbol: string;
  average_sentiment: number;
  price_change: number;
  reddit_sentiment: number;
  yfinance_sentiment: number;
  historical: HistoricalData[];
  mean_price: number;
}

function App() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStockData = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:8000/compare/${ticker}`);
      console.log("Response data:", res.data);
      setStockData(res.data);
      setSymbol(ticker);
    } catch (err: any) {
      console.error("Error fetching stock data:", err);
      setError(err.response?.data?.detail || "Failed to fetch stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData(symbol);
  }, []);

  const formatPercent = (value: number) => {
    if (isNaN(value)) return "N/A";
    const percent = (value * 100).toFixed(2);
    return `${percent}%`;
  };

  const isPositive = (value: number) => value >= 0;

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-1 font-semibold">
            {data.date}
          </p>
          {data.close !== null && (
            <p className="text-blue-400 text-sm font-semibold">
              Close: ${data.close.toFixed(2)}
            </p>
          )}
          {data.ma5 !== null && (
            <p className="text-orange-400 text-sm font-semibold">
              MA5: ${data.ma5.toFixed(2)}
            </p>
          )}
          {data.predicted_close !== null && (
            <p className="text-green-400 text-sm font-semibold">
              Predicted: ${data.predicted_close.toFixed(2)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Find the index where predictions start (where close becomes null)
  const getPredictionStartIndex = () => {
    if (!stockData?.historical) return -1;
    return stockData.historical.findIndex((d) => d.close === null);
  };

  return (
    <div className="grid h-screen bg-black grid-cols-3 grid-rows-3 gap-4 p-4">
      <div className="col-span-2 row-span-1 flex flex-row justify-between gap-4 ml-4">
        {/* Average Sentiment Card */}
        <div className="flex-1 rounded-2xl ring-1 p-6 flex flex-col justify-between text-white ">
          <div className="flex justify-between items-start">
            <span
              className={`${
                stockData && isPositive(stockData.average_sentiment)
                  ? "bg-green-400/20 text-green-400"
                  : "bg-red-400/20 text-red-400"
              } text-sm font-medium px-3 py-1 rounded-full`}
            >
              {loading
                ? "Loading..."
                : stockData
                ? stockData.average_sentiment > 0
                  ? "Positive"
                  : "Negative"
                : "---"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-400">Average Sentiment</p>
            <p className="text-4xl font-semibold mt-2">
              {loading
                ? "..."
                : stockData
                ? stockData.average_sentiment.toFixed(3)
                : "---"}
            </p>
          </div>
        </div>

        {/* Price Change Card */}
        <div className="flex-1 rounded-2xl ring-1 p-6 flex flex-col justify-between text-white ">
          <div className="flex justify-between items-start">
            <span
              className={`${
                stockData &&
                !isNaN(stockData.price_change) &&
                isPositive(stockData.price_change)
                  ? "bg-green-400/20 text-green-400"
                  : "bg-red-400/20 text-red-400"
              } text-sm font-medium px-3 py-1 rounded-full`}
            >
              {loading
                ? "Loading..."
                : stockData && !isNaN(stockData.price_change)
                ? `${formatPercent(stockData.price_change)} ${
                    isPositive(stockData.price_change) ? "↑" : "↓"
                  }`
                : "---"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-400">Price Change (1M)</p>
            <p className="text-4xl font-semibold mt-2">
              {loading
                ? "..."
                : stockData
                ? formatPercent(stockData.price_change)
                : "---"}
            </p>
          </div>
        </div>

        {/* Reddit Sentiment Card */}
        <div className="flex-1 rounded-2xl p-6 flex flex-col ring-1  justify-between text-white">
          <div className="flex justify-between items-start">
            <span
              className={`${
                stockData && isPositive(stockData.mean_price)
                  ? "bg-green-400/20 text-green-400"
                  : "bg-red-400/20 text-red-400"
              } text-sm font-medium px-3 py-1 rounded-full`}
            >
              {loading ? "Loading..." : "Average Price"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-400">Average Price</p>
            <p className="text-4xl font-semibold mt-2">
              {loading
                ? "..."
                : stockData
                ? stockData.mean_price.toFixed(3)
                : "---"}
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="col-span-2 row-start-2 row-span-2 ml-4 p-6 rounded-2xl flex items-center justify-center ring-1 ring-amber-50 ">
        {loading ? (
          <div className="text-white text-xl">Loading chart data...</div>
        ) : error ? (
          <div className="text-red-400 text-xl">{error}</div>
        ) : stockData &&
          stockData.historical &&
          stockData.historical.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stockData.historical}
              margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
            >
              <CartesianGrid stroke="#444" strokeDasharray="5 5" />
              <XAxis
                dataKey="date"
                stroke="#A0AEC0"
                tickLine={false}
                tick={{ fill: "#A0AEC0", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#A0AEC0"
                tickLine={false}
                tick={{ fill: "#A0AEC0", fontSize: 12 }}
                domain={["auto", "auto"]}
                label={{
                  value: "Price ($)",
                  position: "insideLeft",
                  angle: -90,
                  fill: "#A0AEC0",
                }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Add a vertical line to separate historical from predictions */}
              {getPredictionStartIndex() > 0 && (
                <ReferenceLine
                  x={stockData.historical[getPredictionStartIndex() - 1].date}
                  stroke="#888"
                  strokeDasharray="3 3"
                  label={{
                    value: "Predictions →",
                    position: "top",
                    fill: "#A0AEC0",
                    fontSize: 12,
                  }}
                />
              )}

              <Legend
                iconType="line"
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => (
                  <span style={{ color: "#E2E8F0" }}>{value}</span>
                )}
              />

              {/* Historical Closing Price */}
              <Line
                type="monotone"
                dataKey="close"
                stroke="#63B3ED"
                strokeWidth={3}
                name="Closing Price"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#63B3ED",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                connectNulls={false}
              />

              {/* 5-Day Moving Average */}
              <Line
                type="monotone"
                dataKey="ma5"
                stroke="#F6AD55"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="5-Day MA"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#F6AD55",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                connectNulls={false}
              />

              {/* Predicted Prices */}
              <Line
                type="monotone"
                dataKey="predicted_close"
                stroke="#48BB78"
                strokeWidth={3}
                strokeDasharray="8 4"
                name="Predicted Price"
                dot={{
                  r: 4,
                  fill: "#48BB78",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "#48BB78",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-white text-xl">No chart data available</div>
        )}
      </div>

      {/* Search Panel */}
      <div className="col-start-3 row-start-1 row-span-3 flex flex-col gap-4 p-6 rounded-2xl shadow-xl ring-1 ">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-amber-50">Stock Search</h2>
          <div className="ring-1 ring-amber-50 w-full rounded-xl flex overflow-hidden">
            <input
              className="pl-4 py-3 rounded-xl flex-1 text-amber-50 bg-transparent outline-none"
              name="ticker search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  fetchStockData(inputValue.trim());
                }
              }}
              placeholder="Enter symbol (e.g., AAPL)"
              disabled={loading}
            />
          </div>
          <button
            onClick={() =>
              inputValue.trim() && fetchStockData(inputValue.trim())
            }
            disabled={loading}
            className="ring-1 ring-amber-50  hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {stockData && (
          <div className="flex-1 flex flex-col gap-4 mt-4">
            <div className="text-center">
              <div className="text-4xl font-bold  text-amber-50">
                {stockData.symbol}
              </div>
              <div className="text-sm text-gray-400 mt-1">Stock Symbol</div>
            </div>

            <div className=" ring-1 ring-amber-50 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">
                YFinance Sentiment
              </div>
              <div className="text-2xl font-bold text-amber-50">
                {stockData.yfinance_sentiment.toFixed(3)}
              </div>
            </div>
            <div className=" ring-1 ring-amber-50 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">Reddit Sentiment</div>
              <div className="text-2xl font-bold text-amber-50">
                {stockData.reddit_sentiment.toFixed(3)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
