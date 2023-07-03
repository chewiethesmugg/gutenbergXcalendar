# GutenbergXCalendar
A simple web app that automatically creates events in your google calendar to motivate you to read books.

### How Does It Work?
- My app allows you to either get a specific book that you desire or it gets a random book for you from the Gutenberg online library. 
- Depending on the popularity of the book a new calendar event in your google calendar is created. 
- You'll either get 30 days, 21 days or 14 days to read a book. The more popular it is, the less time you get.  

#### Requirements
- A Google Cloud project with the Google Calendar api already added to it.
- The latest version of [Node](https://nodejs.dev/en/learn/how-to-install-nodejs/) already installed in your system.


#### How To Get It Running:
1. Download all the files in this repo into a folder, name it what you wish.
2. Then log into the google developer console and create a Google Calendar project. Make sure to save the credentials they give in the folder you used in the previous step.
- Replace all the information in the **<>** in the **credentials.json** with the credentials you received from the previous step. 
3. Open terminal, navigate to the folder with the code. Start the server with:
    ```
    node main.js
    ```
4. Open your browser and type in localhost:3000 to open up a client to access the app. 
5. Once you've selected a book, you will be prompted to log into your Google account. 
5. Enjoy!