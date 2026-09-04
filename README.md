# Origin-Hackathon
# 🌦️ Weather and AQI based Health Advisory using AI

## 📌 Description

The application uses the data about real-time weather and AQI, as well as other relevant user data such as **age, health condition, and occupation** and gives **personalized health advisories** using AI.

## 🎯 Features

* 📍 Live weather & AQI dashboard
* 👤 User profile: age group, health condition, occupation
* 🤖 AI-powered personalized health advisory
* 📊 7-day AQI/weather forecast and alert history
* ⚡ Real-time data and no dummy data used

## 🛠️ Tools Used

* **Frontend:** Streamlit
* **Backend:** Python
* **Weather:** Open-Meteo
* **AQI:** WAQI / data.gov.in
* **AI:** Groq / Gemini Free
* **Data/Charts:** Pandas, Plotly
* **Storage:** SQLite/CSV

## 🔄 Workflow

```text
User Profile + Location
          ↓
   Weather + AQI APIs
          ↓
      Data Processing
          ↓
       LLM Free Tier
          ↓
 Personalized Health Advisory
          ↓
   Dashboard + 7-Day Forecast
```

## 🚀 How To Run

```bash
pip install -r requirements.txt
streamlit run app.py
```

Add your API keys in `.env` file.

## 📡 Data Source

* [Open-Meteo](https://open-meteo.com/?utm_source=chatgpt.com)
* [WAQI](https://aqicn.org/api/?utm_source=chatgpt.com)
* [data.gov.in](https://www.data.gov.in/?utm_source=chatgpt.com)

## ⚠️ Disclaimer

This project serves as general environmental health advisory. It should NOT be used as a substitute
