from typing import Union
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from fastapi import FastAPI, HTTPException # pyright: ignore[reportMissingImports]
import yfinance as yf # pyright: ignore[reportMissingImports]
import pandas as pd # pyright: ignore[reportMissingModuleSource, reportMissingImports]
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer # pyright: ignore[reportMissingImports]
import praw # pyright: ignore[reportMissingImports]
import os
from dotenv import load_dotenv
# import snscrape.modules.twitter as sntwitter # pyright: ignore[reportMissingImports]
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from datetime import timedelta


app = FastAPI()
analyzer = SentimentIntensityAnalyzer()
load_dotenv()

client_id = os.getenv("REDDIT_CLIENT_ID")
client_secret = os.getenv("REDDIT_CLIENT_SECRET")
user_agent = os.getenv("REDDIT_USER_AGENT")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)



reddit = praw.Reddit(
    client_id=client_id,
    client_secret=client_secret,
    user_agent="my-stock-sentiment-app by u/YourRedditUsername",
)



def reddit_sentiment_analysis(symbol: str, limit: int = 25):
    subreddit = reddit.subreddit("stocks")
    reddit_scores = []
    for submission in subreddit.search(symbol, limit=limit):
        title = submission.title
        score = analyzer.polarity_scores(title)['compound']
        reddit_scores.append(score)
    # calculated mean sentiment score from reddit data    
    if (not reddit_scores):
       return 0 
    else:
        return (sum(reddit_scores) / len(reddit_scores))


'''
def X_sentiment_analysis(symbol: str, limit: int = 25):
    x_scores = []
    tweets = sntwitter.TwitterSearchScraper(f"{symbol} since:2025-10-01").get_items()
    for i, tweet in enumerate(tweets):
        if i >= limit:
            break
        score = analyzer.polarity_scores(tweet.content)['compound']
        x_scores.append(score)
    return sum(x_scores) / len(x_scores) if x_scores else 0

'''

@app.get("/predict/{symbol}")
def predict_stock(symbol: str):
    # Fetch last 6 months of data
    data = yf.download(symbol, period="6mo", interval="1d")

    if data.empty or len(data) < 30:
        raise HTTPException(status_code=404, detail=f"{symbol} data not found or insufficient data from Yahoo Finance.")
    
    # Handle multi-index columns if necessary
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data.reset_index(inplace=True)
    data = data.dropna(subset=["Close"])

    # ---- Feature Engineering ----
    data["Day"] = pd.Series(range(len(data)))
    data["MA5"] = data["Close"].rolling(window=5).mean()
    data["MA10"] = data["Close"].rolling(window=10).mean()
    data["Momentum"] = data["Close"].pct_change()
    data = data.dropna()

    # ---- Prepare features and target ----
    X = data[["Day", "MA5", "MA10", "Momentum"]]
    y = data["Close"]

    # ---- Train/test split ----
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False  # no random shuffling — time-ordered data
    )

    # ---- Train Random Forest ----
    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)

    # Evaluate (optional but good to log)
    test_predictions = model.predict(X_test)
    test_r2 = model.score(X_test, y_test)

    # ---- Predict next 7 days ----
    last_day = data["Day"].iloc[-1]
    last_date = data["Date"].iloc[-1]
    future_predictions = []

    # Make predictions iteratively using last known data
    recent_closes = list(data["Close"].iloc[-10:])

    for i in range(1, 8):
        next_day = last_day + i
        ma5 = pd.Series(recent_closes[-5:]).mean()
        ma10 = pd.Series(recent_closes[-10:]).mean()
        momentum = (recent_closes[-1] - recent_closes[-2]) / recent_closes[-2] if len(recent_closes) > 1 else 0

        X_next = pd.DataFrame([[next_day, ma5, ma10, momentum]], columns=["Day", "MA5", "MA10", "Momentum"])
        pred = model.predict(X_next)[0]

        # append for next iterations
        recent_closes.append(pred)
        future_predictions.append({
            "date": (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
            "predicted_close": float(pred)
        })

    return {
        "symbol": symbol,
        "test_r2_score": float(test_r2),
        "predicted_next_7_days": future_predictions
    }
     

@app.get("/compare/{symbol}")
def compare_stock(symbol: str):
    # fetch historical stock data
    data = yf.download(symbol, period="1mo", interval="1d")

    if data.empty or len(data) < 2:
        raise HTTPException(status_code=404, detail=f"{symbol} data not found or insufficient data from Yahoo Finance.")
    
    # Check if we have multi-level columns (happens with single ticker sometimes)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    
    data.reset_index(inplace=True)
    
    # Drop rows with NaN in Close column
    data = data.dropna(subset=['Close'])
    
    if len(data) < 2:
        raise HTTPException(status_code=404, detail=f"Insufficient valid data for {symbol}")
    
    # Convert Date to string format for JSON serialization
    data["Date"] = data["Date"].dt.strftime("%Y-%m-%d")

    # sample headlines for sentiment analysis
    headlines = [
        f"{symbol} stock rises after strong earnings report",
        f"Analysts show mixed sentiment toward {symbol}",
        f"{symbol} faces supply chain issues, investors react cautiously"
    ]

    scores = [analyzer.polarity_scores(h)['compound'] for h in headlines]

    # calculates mean sentiment score
    reddit_sentiment_scores = reddit_sentiment_analysis(symbol)
    yfinance_sentiment_scores = sum(scores) / len(scores) 
    avg_sentiment = (yfinance_sentiment_scores + reddit_sentiment_scores) / 2
    
    # % change in price between first and last day closing 
    first_close = float(data["Close"].iloc[0])
    last_close = float(data["Close"].iloc[-1])
    
    # Debug print (you can remove this later)
    print(f"First close: {first_close}, Last close: {last_close}")
    
    price_change = float((last_close - first_close) / first_close)
    
    # Calculate 5-day moving average
    data["MA5"] = data["Close"].rolling(window=5).mean()

    # Prepare historical data for the chart
    historical_data = []
    for _, row in data.iterrows():
        historical_data.append({
            "date": row["Date"],
            "close": float(row["Close"]),
            "ma5": float(row["MA5"]) if pd.notna(row["MA5"]) else None
        })

    return {
        "symbol": symbol,
        "average_sentiment": float(avg_sentiment),
        "price_change": price_change,
        "reddit_sentiment": float(reddit_sentiment_scores),
        "yfinance_sentiment": float(yfinance_sentiment_scores),
        "historical": historical_data
    }
