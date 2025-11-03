import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import { useState, useEffect } from "react";

interface HistoricalData {
  date: string;
  close: number;
  ma5: number | null;
}

interface StockData {
  symbol: string;
  average_sentiment: number;
  price_change: number;
  reddit_sentiment: number; // Changed from "reddit sentiment"
  yfinance_sentiment: number; // Changed from "yfinance sentiment"
  historical: HistoricalData[];
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
      console.log("Response data:", res.data); // Debug log
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

  // Format percentage for display
  const formatPercent = (value: number) => {
    if (isNaN(value)) return "N/A";
    const percent = (value * 100).toFixed(2);
    return `${percent}%`;
  };

  // Determine if value is positive
  const isPositive = (value: number) => value >= 0;

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-1">
            {payload[0].payload.date}
          </p>
          <p className="text-blue-400 text-sm font-semibold">
            Close: ${payload[0].value.toFixed(2)}
          </p>
          {payload[1] && payload[1].value && (
            <p className="text-orange-400 text-sm font-semibold">
              MA5: ${payload[1].value.toFixed(2)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid h-screen bg-black grid-cols-3 grid-rows-3 gap-4 p-4">
      <div className="col-span-2 row-span-1 flex flex-row justify-between gap-4 ml-4">
        {/* Average Sentiment Card */}
        <div className="flex-1 rounded-2xl ring-1 p-6 flex flex-col justify-between text-white">
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
        <div className="flex-1 rounded-2xl ring-1 p-6 flex flex-col justify-between text-white">
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
        <div className="flex-1 rounded-2xl p-6 flex flex-col ring-1 justify-between text-white">
          <div className="flex justify-between items-start">
            <span
              className={`${
                stockData && isPositive(stockData.reddit_sentiment)
                  ? "bg-green-400/20 text-green-400"
                  : "bg-red-400/20 text-red-400"
              } text-sm font-medium px-3 py-1 rounded-full`}
            >
              {loading ? "Loading..." : "Reddit"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-400">Reddit Sentiment</p>
            <p className="text-4xl font-semibold mt-2">
              {loading
                ? "..."
                : stockData
                ? stockData.reddit_sentiment.toFixed(3)
                : "---"}
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="col-span-2 row-start-2 row-span-2 ml-4 p-6 rounded-2xl flex items-center justify-center ring-1">
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
              <Legend
                iconType="line"
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => (
                  <span style={{ color: "#E2E8F0" }}>{value}</span>
                )}
              />
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
              />
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
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-white text-xl">No chart data available</div>
        )}
      </div>

      {/* Search Panel */}
      <div className="col-start-3 row-start-1 row-span-3 flex flex-col gap-4 p-6 rounded-2xl shadow-xl text-gray-900">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-amber-50">Stock Search</h2>
          <div className="ring-1 w-full rounded-xl flex overflow-hidden">
            <input
              className="pl-4 py-3 rounded-xl flex-1 text-amber-50 bg-transparent outline-none ring-1"
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
            className="ring-1 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {stockData && (
          <div className="flex-1 flex flex-col gap-4 mt-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-50">
                {stockData.symbol}
              </div>
              <div className="text-sm text-amber-50 mt-1">Stock Symbol</div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4">
              <div className="text-sm text-amber-50 mb-1">
                YFinance Sentiment
              </div>
              <div className="text-2xl font-bold text-amber-50">
                {stockData.yfinance_sentiment.toFixed(3)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
