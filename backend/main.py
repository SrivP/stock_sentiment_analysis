from typing import Union
from fastapi.middleware.cors import CORSMiddleware # pyright: ignore[reportMissingImports]
from fastapi import FastAPI, HTTPException # pyright: ignore[reportMissingImports]
import yfinance as yf # pyright: ignore[reportMissingImports]
import pandas as pd # pyright: ignore[reportMissingModuleSource, reportMissingImports]
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer # pyright: ignore[reportMissingImports]
import praw # pyright: ignore[reportMissingImports]
import os
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from datetime import timedelta
import uvicorn

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
    if (not reddit_scores):
       return 0 
    else:
        return (sum(reddit_scores) / len(reddit_scores))
    
def yfinance_news_sentiment_analysis(symbol: str, limit: int = 10):
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news
        
        if not news:
            print(f"No news found for {symbol}")
            return 0, []
        
        scores = []
        headlines = []
        
        # Limit to specified number of articles
        for article in news[:limit]:
            # Get the title of the article
            title = article.get('title', '')
            if title:
                score = analyzer.polarity_scores(title)['compound']
                scores.append(score)
                headlines.append({
                    'title': title,
                    'sentiment': score,
                    'publisher': article.get('publisher', 'Unknown'),
                    'link': article.get('link', '')
                })
        
        avg_score = sum(scores) / len(scores) if scores else 0
        return avg_score, headlines
        
    except Exception as e:
        print(f"Error fetching news for {symbol}: {e}")
        return 0, []

def predict_future_prices(symbol: str, days: int = 7):
    try:
        # Fetch last 6 months of data
        data = yf.download(symbol, period="6mo", interval="1d")

        if data.empty or len(data) < 30:
            return []
        
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        data.reset_index(inplace=True)
        data = data.dropna(subset=["Close"])

        data["Day"] = pd.Series(range(len(data)))
        data["MA5"] = data["Close"].rolling(window=5).mean()
        data["MA10"] = data["Close"].rolling(window=10).mean()
        data["Momentum"] = data["Close"].pct_change()
        data = data.dropna()

        X = data[["Day", "MA5", "MA10", "Momentum"]]
        y = data["Close"]

        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )

        # Train Random Forest
        model = RandomForestRegressor(n_estimators=200, random_state=42)
        model.fit(X_train, y_train)

        last_day = data["Day"].iloc[-1]
        last_date = data["Date"].iloc[-1]
        future_predictions = []

        recent_closes = list(data["Close"].iloc[-10:])

        for i in range(1, days + 1):
            next_day = last_day + i
            ma5 = pd.Series(recent_closes[-5:]).mean()
            ma10 = pd.Series(recent_closes[-10:]).mean()
            momentum = (recent_closes[-1] - recent_closes[-2]) / recent_closes[-2] if len(recent_closes) > 1 else 0

            X_next = pd.DataFrame([[next_day, ma5, ma10, momentum]], columns=["Day", "MA5", "MA10", "Momentum"])
            pred = model.predict(X_next)[0]

            recent_closes.append(pred)
            future_predictions.append({
                "date": (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "predicted_close": float(pred)
            })

        return future_predictions
    except Exception as e:
        print(f"Prediction error: {e}")
        return []

@app.get("/compare/{symbol}")
def compare_stock(symbol: str):
    # fetch historical stock data
    data = yf.download(symbol, period="1mo", interval="1d")

    if data.empty or len(data) < 2:
        raise HTTPException(status_code=404, detail=f"{symbol} data not found or insufficient data from Yahoo Finance.")
    
    # Check if we have multi-level columns
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    
    data.reset_index(inplace=True)
    data = data.dropna(subset=['Close'])
    mean_price = data["Close"].mean()
    
    if len(data) < 2:
        raise HTTPException(status_code=404, detail=f"Insufficient valid data for {symbol}")
    
    # Convert Date to string format
    data["Date"] = data["Date"].dt.strftime("%Y-%m-%d")

    

    # Sample headlines for sentiment analysis
    headlines = [
        f"{symbol} stock rises after strong earnings report",
        f"Analysts show mixed sentiment toward {symbol}",
        f"{symbol} faces supply chain issues, investors react cautiously"
    ]

    scores = [analyzer.polarity_scores(h)['compound'] for h in headlines]

    # Calculate mean sentiment score
    reddit_sentiment_scores = reddit_sentiment_analysis(symbol)
    yfinance_sentiment_scores = sum(scores) / len(scores) 
    avg_sentiment = (yfinance_sentiment_scores + reddit_sentiment_scores) / 2
    
    # % change in price
    first_close = float(data["Close"].iloc[0])
    last_close = float(data["Close"].iloc[-1])
    
    print(f"First close: {first_close}, Last close: {last_close}")
    
    price_change = float((last_close - first_close) / first_close)
    
    # Calculate 5-day moving average
    data["MA5"] = data["Close"].rolling(window=5).mean()

    # Prepare historical data
    historical_data = []
    for _, row in data.iterrows():
        historical_data.append({
            "date": row["Date"],
            "close": float(row["Close"]),
            "ma5": float(row["MA5"]) if pd.notna(row["MA5"]) else None,
            "predicted_close": None  # Historical data has no predictions
        })

    # Get predictions and append them
    predictions = predict_future_prices(symbol, 7)
    for pred in predictions:
        historical_data.append({
            "date": pred["date"],
            "close": None,  # No actual close price for future dates
            "ma5": None,
            "predicted_close": pred["predicted_close"]
        })

    return {
        "symbol": symbol,
        "average_sentiment": float(avg_sentiment),
        "price_change": price_change,
        "reddit_sentiment": float(reddit_sentiment_scores),
        "yfinance_sentiment": float(yfinance_sentiment_scores),
        "historical": historical_data,
        "mean_price": float(mean_price)

    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)