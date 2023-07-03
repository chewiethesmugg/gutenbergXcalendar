const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const querystring = require("querystring");

const {client_id,auth_uri,token_uri,client_secret,scope,redirect_uri,response_type,grant_type} = require("./credentials.json");
//array to store states of all our connections
let all_connections=[];

//creating out server
const port = 3000;
const server = http.createServer();

server.on("listening", listen_handler);
server.on("request", request_handler);
server.listen(port);

function listen_handler() {
    console.log(`Gutenberg X Calendar Server is listening on ${port}`);
}

function request_handler(req, res) {
    console.log(`New Request from ${req.socket.remoteaddress} for ${req.url}`);
    if (req.url === "/") {
        const form = fs.createReadStream("index.html");
        res.writeHead(200, {"Content-Type": "text/html"});
        form.pipe(res);
    } 
    //we get a search request
    else if (req.url.startsWith("/books")) {
        const user_input = new URL(req.url, `https://{req.headers.host}`).searchParams;
        title = user_input.get('title');
        random = user_input.get('random');
        
        //checking for bad input
        if (title == null && random == null) {
            not_found(res);
        }

        //we got random input
        else if ((title == null || title == "") && random == "on") {
            console.log("Requested random book");
            //generating a random book id
            const randId = Math.floor(Math.random() * 8000);
            const gutenEndpoint = `https://gutendex.com/books/?ids=${randId}`;
            let options  ={method:"GET"};
            const gutenCall = https.request(gutenEndpoint,options, (guten_res) => process_stream(guten_res, parse_guten,res)).end();

        } else {
            console.log("Reqested title search");
            const titleCleaned = title.replace(/\s/g,'%20');
            let gutenEndpoint2 = `https://gutendex.com/books/?search=${titleCleaned}`;
            let options = {method:"GET"};
            const gutenCall2 = https.request(gutenEndpoint2,options,(guten_res) => process_stream(guten_res, parse_title,res)).end();
        }

    }
    //API sent back code
    else if (req.url.startsWith("/receive_code")) {
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const code = user_input.get("code");
        let tempstate = user_input.get("state");
        const state = tempstate.substring(0,tempstate.length-1);

        let connection = all_connections.find((connection) => connection.state === state);
        if (code === undefined || state === undefined || connection === undefined) {
            not_found(res);
            return;
        }
        //getting the user connection's specific info they stored from gutenberg
        const { downloads, title, rand} = connection;
        send_access_token_request(code, {downloads, title, rand}, res);
    }   
    else {
       not_found(res);
    }
}

function process_stream(stream, callback, ...args) {
    let body = "";
    stream.on("data", chunk => body += chunk);
    stream.on("end", () => callback(body, ...args));
}

//this function parsing the data sent from gutendex and makes the call to google calendar
function parse_guten(guten_data,res){
    console.log("Got a random request");
    let data = JSON.parse(guten_data);
    let downloads= data.results[0].download_count;
    let title = data.results[0].title;
    let rand = true;
    const state = crypto.randomBytes(20).toString("hex");
    let gutenData = {downloads,title,state,rand};
    all_connections.push(gutenData);
    //can do a lookup for info using state
    call_calendar(state,res);
}

//this is for parsing a title only request
//the rand varaible is set to false
function parse_title(guten_data,res){
    console.log("Got a title request");
    let data = JSON.parse(guten_data);
    let downloads= data.results[0].download_count;
    let title = data.results[0].title;
    let rand = false;
    const state = crypto.randomBytes(20).toString("hex");
    let gutenData = {downloads,title,state,rand};
    all_connections.push(gutenData);
    //can do a lookup for info using state
    call_calendar(state,res);
}

//this function creates state
function call_calendar(state, res) {
    console.log("Calling calendar api state: "+state);
    const auth_end_point = "https://accounts.google.com/o/oauth2/auth";
    let params = new URLSearchParams({client_id,redirect_uri,response_type,scope,state}).toString();
    res.writeHead(302, {Location: `${auth_end_point}?${params}}`}).end();
}

function send_access_token_request(code, user_input, res) {
    const get_token_endpoint=token_uri;
    const token_access_body = new URLSearchParams({code, client_id, client_secret,grant_type,redirect_uri}).toString();
	let options = {
		method: "POST",
		headers:{
            'Host': 'oauth2.googleapis.com',
			"Content-Type":"application/x-www-form-urlencoded"
		}
	}
	https.request(
		get_token_endpoint, 
		options, 
		(token_stream) => process_stream(token_stream, receive_token,user_input,res)
	).end(token_access_body);
}

function receive_token(body,user_input,res) {
    console.log("Got auth token");
    const {access_token}= JSON.parse(body);
    add_event_to_calendar(access_token,user_input,res);
}

//adds a task to read a book within a certain time frame depending how many downloads
function add_event_to_calendar(access_token,user_input,res){
    console.log("Adding new reading event to calendar.");
    //this endpoitn includes the calendarid of my specific google calendar
    const calendar_endpoint = "https://www.googleapis.com/calendar/v3/calendars/e7ad22312318a9716630ba8a3aa27afbe6477430779c3d6f43cf898822ee4440@group.calendar.google.com/events";
    //getting the user's data using their state
    const { downloads,title, rand} = user_input; 
    
    //download number condition
    //the higher the number of downloads, the less time the user is given to read the book
    let added_days = -1;
    if(downloads<10){added_days=30;}
    else if(downloads<100){added_days=21;}
    else if(downloads<1000){added_days=14;}
    else{added_days=7;};

    //getting the date parameters
    let dated = new Date();
    let startdate = null;
    let enddate = null;
    //check if random
    if(rand){
        startdate = dated.getFullYear()+'-'+(dated.getMonth()+1)+'-'+dated.g  etDate();
        let date = new Date(new Date().getTime()+(added_days*24*60*60*1000));
        enddate = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
    }
    //otherwise the default read time is 2 weeks, like my local library!
    else{
        startdate = dated.getFullYear()+'-'+(dated.getMonth()+1)+'-'+dated.getDate();
        let date = new Date(new Date().getTime()+(7*24*60*60*1000));
        enddate = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
    }

    const summ = `Read: ${title}`;
    const post_data = JSON.stringify(
        {
            'summary':summ,
            'start':{
                'date':startdate,
            },
            'end':{
                'date':enddate,
            }
        }
    )

    const options = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${access_token}`
		}
	}
	https.request(
		calendar_endpoint, 
		options, 
		(event_stream) => process_stream(event_stream, receive_event_response, res)
	).end(post_data);

}

function receive_event_response(body,res){
    const results = JSON.parse(body);
    res.writeHead(200,  {"Content-Type": "text/html"})
	   .end(`<h1>Event <i>${results.summary}</i> was added to calendar!!`);
}

function not_found(res) {
    res.writeHead(404, {"Content-Type": "text/html"});
    res.end(`<h1>404 Not Found</h1>`);
}