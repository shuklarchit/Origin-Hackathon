# 🌦️ Weather and AQI health advisory via AI

## 📌 Introduction

AI based application which gives personal health advisory using real time weather, AQI and user details. Instead of giving general alerts, the application takes into account some specific factors like **age, health issues and occupation** to provide suitable suggestions.

## 🎯 Features

* 📍 Real time live weather & AQI dashboard 
* 👤 User profile including age, health condition and occupation
* 🤖 AI generated personal health advisory
* 📊 7 day AQI/weather trend graph along with alert history
* ⚡ Real time data without any mock data

## 🛠️ Tech stack

* **Frontend:** Streamlit
* **Backend:** Python
* **Weather:** Open-Meteo
* **AQI:** WAQI / data.gov.in
* **AI:** Groq / Gemini Free Tier
* **Data & graphs:** Pandas, Plotly
* **Database:** SQLite / CSV

## 🔄 Workflow

```text
User Profile + Location
          ↓
   Weather + AQI APIs
          ↓
      Data Processing
          ↓
       Free LLM
          ↓
 Personalized Health Advisory
          ↓
   Dashboard + 7 Day Trends
```

## 🚀 Deployment

```bash
pip install -r requirements.txt
streamlit run app.py
```

Put necessary API keys in `.env`.

## 📡 API Sources

* [Open-Meteo](https://open-meteo.com/?utm_source=chatgpt.com)
* [WAQI](https://aqicn.org/api/?utm_source=chatgpt.com)
* [data.gov.in](https://www.data.gov.in/?utm_source=chatgpt.com)

## ⚠️ Disclaimer

This application gives **general environmental health guidance** and doesn’t replace professional medical
