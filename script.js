
let joining = false
$(document).ready(function () {
    let url_params = window.location.search
    if (url_params){
        gamecode = url_params.slice(1, url_params.length)
        if (gamecode.length === 5){
            role = "spectator"
            joining = true
            set_menu("WaitForConnection")
        }
        if (gamecode.length === 10){
            role = "editor"
            joining = true
            set_menu("WaitForConnection")
        }
    }
    if(!joining){
        if (load_game()){
            if (gamecode.length > 5){
                $("#start-continue").show()
            }
        }
    }
    randomize_beers()
    const button = $(".actionbutton")
    button.on("click", function () {
        do_action(this.id)
    });
    let hold;
    button.on('mousedown touchstart', function () {
        $("#bottomtext").text("")
        if(this.id.split("-")[1]==="select"){
            holdplayer = 0
        }
        let elem = this
        hold = setTimeout(function () {
            set_hold(elem.id)
        }, 1000)
    });
    button.on('mouseup touchend mouseout', function () {
        clearTimeout(hold)
    });
    $(".selectables > .beerspot").on("click", function () {
        hit_beer(this.id)
    });

    let hold2;
    $("#mid_thing").on('mousedown touchstart', function () {
        hold2 = setTimeout(function () {
            flip_locked = !flip_locked
            set_flip()
        }, 1000)
    });
    $("#mid_thing").on('mouseup touchend mouseout', function () {
        clearTimeout(hold2)
    });


    $("#mid_thing").on("click", function () {
        flip = !flip
        if ((role === "host" || role === "editor") && !flip_locked){
            send_data("update_flip", {"flip": flip, "last_update": last_update_from_server[0]})
            server_flip = flip
        }
        set_flip(true)
    });
    setInterval(update_clock, 100)
    $('#team-emoji-input').on('input',function(e){
        let emoji = $('#team-emoji-input').val()
        $('#team-emoji-input').val(test_emoji(emoji))
    });

    $("#share").on("click", function () {
        show_popup("sharepopup")
    });
    if (joining){
        join()
    }
});

let role = "host"
let is_online = false
let verbosity = 2
let verbose_times = true
let gamecode = ""
let log_list = []

let last_update_from_server = [-1,-1]
let waiting_response = {

}

const socket = new WebSocket('wss://fbstats.jsloth.fi');
// Connection opened
socket.addEventListener('open', function (event) {
    is_online = true

    if (joining){
        join()
    } else {
        send_data("get_games", {});
    }

});
// Listen for messages

function check_up_to_date(msg){
    let last = true
    if (waiting_response.length > 0){
        last = false
    }
    if ("last_update" in msg){
        console.log(msg.last_update)
        console.log(last_update_from_server)
        if (last_update_from_server[0] === -1){
            last_update_from_server = msg.last_update
            return [true, false, last]
        }
        if (last_update_from_server[1] === msg.last_update[1]-1){
            last_update_from_server = msg.last_update
            return [true, true, last]
        }
        last_update_from_server = msg.last_update
        return [false, false, false]
    }
    return [true, false, last]
}

let conflicted = false
socket.addEventListener('message', function (message) {
    let msg = JSON.parse(message.data)
    log(2,"received: " + message.data)

    let up_to_date = check_up_to_date(msg)

    switch (msg.type){
        case "error":
            log(1, "ERROR: " + msg.message + " " + msg.recv_msg_id)
            if (msg.recv_msg_id in waiting_response){
                delete waiting_response[msg.recv_msg_id]
                send_data("get_actions", {})
            }
            break
        case "ok":
            conflicted = false
            if (msg.recv_msg_id in waiting_response){
              delete waiting_response[msg.recv_msg_id]
            }
            break
        case "spectator_count":
            update_spectator_count(msg.spectators)
            break
        case "game_list":
            update_game_list(msg.games)
            break
        case "init_host":
            gamecode = msg.hostcode
            localStorage.gamecode = JSON.stringify(gamecode);
            set_share()
            break
        case "init_rehost":
            reset_game(msg.teams, msg.actions)
            set_share()
            break
        case "init_editor":
            reset_game(msg.teams, msg.actions)
            set_share()
            save_game(true)
            break
        case "init_spectator":
            setup_spectate_mode()
            set_share()
            reset_game(msg.teams, msg.actions)
            save_game(true)
            break
        case "timing_conflict":
            if (up_to_date[0] === false || up_to_date[1] === false || conflicted){
                send_data("get_actions", {})
            } else {
                let re_sent = waiting_response[msg.recv_msg_id]
                if (re_sent){
                    conflicted = true
                    send_data(re_sent["type"], re_sent, true)
                }
            }
            if (msg.recv_msg_id in waiting_response){
                delete waiting_response[msg.recv_msg_id]
            }
            log(1, "Timing conflict!")
            break
        case "reset_actions":
            waiting_response = []
            reset_game(teams, msg.actions)
            break
        case "reset_teams":
            reset_game(msg.teams, actions)
            break
        case "reset_request":
            if (up_to_date[0] === false || up_to_date[1] === false || up_to_date[2] === false ){
                return
            }
            if (role === "host" || role === "editor"){
                send_data("update_actions", {"actions": actions, "request_id": msg.last_update[0]+msg.last_update[1], "last_update": last_update_from_server[0]});
            }
            break
        case "new_action":
            console.log(up_to_date)
            if (up_to_date[0] === false || up_to_date[1] === false) {
                send_data("get_actions", {})

            }
            execute_action(msg.action)
            break
        case "set_flip":
            server_flip = msg.flip
            set_flip()
            break
        case "orphaned":
            //show_orphaned() // TODO
            break
    }
});

function join(cntn=false){
    switch (role){
        case "host":
            if (!cntn){
                send_data("host",{}, true)
            } else {
                send_data("request_host",{"hostcode": gamecode}, true)
            }
            break
        case "editor":
            send_data("join",{"editcode": gamecode.slice(0, 10)}, true)
            break
        case "spectator":
            send_data("spectate",{"gamecode": gamecode.slice(0, 5)}, true)
            break
    }

}

function send_data(msg_type, msg, wait_for_reply = false) {
    if (is_online){
        msg["type"] = msg_type
        msg["msg_id"] = Date.now()
        if (wait_for_reply){
            waiting_response[msg["msg_id"]] = msg
        }
        log(2,"sending: " + JSON.stringify(msg))
        socket.send(JSON.stringify(msg));
    }
}

function log(v, to_log){
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    if (v >= verbosity){
        if (verbose_times){
            console.log([timestamp, to_log])
        }
        else{
            console.log(to_log)
        }
    }
    log_list.push([timestamp,v,to_log])
}
function update_clock(){
    if (start_time === 0){
        return
    }
    let now_time = Date.now()
    let diffTime = Math.abs(now_time - round_time);
    let hours = Math.floor(diffTime / (1000 * 60 * 60)).toString().padStart(2,"0");
    let minutes = (Math.floor(diffTime / (1000 * 60))%60).toString().padStart(2,"0");
    let seconds = (Math.floor(diffTime / (1000))%60).toString().padStart(2,"0");
    if (hours > 9) {
        $("#hour0").removeClass("hideself")
    }
    $("#hour0").text(hours[0])
    $("#hour1").text(hours[1])
    $("#min0").text(minutes[0])
    $("#min1").text(minutes[1])
    $("#sec0").text(seconds[0])
    $("#sec1").text(seconds[1])

}

function set_flip(override=false){
    if (!override || !flip_locked){
        flip = server_flip
    }
    update_beerlines()
    set_top()
}


const version = 3

const texts = {
    "team": {"fi": "Joukkue", "en": "Team"},
    "player": {"fi": "Pelaaja", "en": "Player"},
    "chose_player": {"fi": "Valitsit pelaajan", "en": "You chose player"},
    "round_start": {"fi": "Erä alkoi", "en": "Round started"},
    "won": {"fi": "voitti erän!", "en": "won the round!"},
    "last_action": {"fi": "Viimeisin tapahtuma:", "en": "Last action:"},
    "round_duration": {"fi": "Erän kesto:", "en": "Round duration:"},
    "flip": {"fi": "flippi", "en": "flip"},
    "flips": {"fi": "flippiä", "en": "flips"},
    "no_games": {"fi": "Pelejä ei löytynyt", "en": "No games. Go home."},
}
let lang = "fi"
let public_game = false
let lastmenu = "StartupActions"
let currentmenu = lastmenu

let holdplayer = 0
let current_player = 0

let selfhit = false
let round_time = 0
let start_time = 0

let game_id = Date.now()

const UP = 1
const FALLEN = 0
const FLIPPED = -1
const LEFT = 0
const RIGHT = 1
let emojis = ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻","🦁","🐮","🐷","🐸","🐵"]

let score = [0,0]
let flip = false
let server_flip = false
let flip_locked = false

let teams = [
    {"ready": false, "teamname": "Team A", "emoji": "", "players": ["Player 1", "Player 2", "Player 3"], "beers":
    [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]},
    {"ready": false, "teamname": "Team B", "emoji": "", "players": ["Player 1", "Player 2", "Player 3"], "beers":
    [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]}
]
let editing = {}
let actions = []
let start_actions = []
let feed = []

let get_games_interval;


function shuffle(array) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function show_popup(eid){
    $("#"+eid).removeClass("hideself")

}
function setup_spectate_mode(){
    $("#menus").addClass("hideself")
    $("#feed_single").addClass("hideself")
    $("#feed-text").addClass("spectate-feed-text")
    $("#mid-scroll").addClass("spectate-mid-scroll")
    $("#mask").addClass("spectate-mask")
}

function update_spectator_count(count){
    if (count > 1){
        $("#spectator_count").removeClass("hideself")
        $("#spectator_count").text("👀" + (count-1))
    } else {
        $("#spectator_count").addClass("hideself")
    }
}

function update_game_list(games){
    let table = ""
    for (let g = 0; g < games.length; g++ ){
        var d = new Date(0);
        d.setUTCSeconds(games[g]["edited"]);
        table += "<tr>" +
            "<td>"+d.toLocaleString()+"</td>" +
            "<td><a href='https://jiisloth.github.io/FrisbeerStatsing/index.html?"+games[g]["code"]+"'>"+games[g]["code"]+"</a></td>" +
            "<td>"+games[g]["teams"][0]["teamname"]+"</td><td>"+games[g]["teams"][0]["emoji"]+"</td>" +
            "<td>"+games[g]["teams"][1]["emoji"]+"</td><td>"+games[g]["teams"][1]["teamname"]+"</td>" +
            "<td>👀"+games[g]["spectators"]+"</td>" +
            "</tr>"
    }
    if(table===""){
        table += "<tr><td>" + texts["no_games"][lang] + "</td></tr>"
    }
    $("#games_table").html(table)
}

function do_action(button) {
    let menu = button.split("-")[0]
    let button_name = button.split("-")[1]
    let button_id = button.split("-")[2]
    $("#sharelinkpressed").text("")
    $("#editlinkpressed").text("")
    $("#actionslinkpressed").text("")
    $("#reportlinkpressed").text("")
    switch (button_name) {
        case "hit":
            selfhit=false
            set_menu("PlayerActions")
            break;
        case "selfhit":
            selfhit=true
            set_menu("PlayerActions")
            break;
        case "select":
            current_player = button_id
            set_edit(get_team(current_player, selfhit))
            update_beerline(-1)
            $(".menulogtext").text(texts["chose_player"][lang] + " " +get_player(current_player))
            set_menu("BeerActions")
            break;
        case "ok":
            if (!set_action("hit")){
                break;
            }
            get_edit(get_team(current_player, selfhit))
            save_game()
            update_beerlines()
            if (holdplayer === 0){
                set_menu("MainActions")
            }
            break;
        case "back":
            set_menu("MainActions")
            $("#bottomtext").text("")
            holdplayer = 0
            break;
        case "tolast":
            set_menu(lastmenu)
            break;
        case "fullback":
            set_menu("StartupActions")
            break;
        case "stats":
            set_menu("StatsActions")
            break;
        case "new":
            game_id = Date.now().toString()
            start_time = 0
            role = "host"
            join()
            shuffle(emojis)
            init_game()
            clear_inputs(texts["team"][lang]+" 1")
            set_menu("SetTeamActions")
            break;
        case "continue":
            if (gamecode.length === 15){
                role = "host"
            } else if (gamecode.length === 10){
                role = "editor"
            }
            join(true)
            load_game()
            load_from_actions()
            break;
        case "teamok":
            let t = set_team_info()
            if (t === 0) {
                clear_inputs(texts["team"][lang]+" 2", 1)
            } else {
                save_game(true)
                send_data("update_teams",{"teams": teams})
                set_playerbuttons()
                set_menu("WaitActions")
                set_top()
            }
            break;
        case "undo":
            set_menu("UndoActions")
            break;
        case "public":
            public_game = !public_game
            send_data("set_public",{"is_public": public_game})
            if (public_game){
                $("#sharepopup-public").text("Piilota")
            } else {
                $("#sharepopup-public").text("Julkaise")
            }
            break;
        case "sharelink":
            $("#sharelinkpressed").text("Kopioitu!")
            navigator.clipboard.writeText("https://jiisloth.github.io/FrisbeerStatsing/index.html?"+gamecode.slice(0,5))
            break;
        case "editlink":
            $("#editlinkpressed").text("Kopioitu!")
            navigator.clipboard.writeText("https://jiisloth.github.io/FrisbeerStatsing/index.html?"+gamecode.slice(0,10))
            break;
        case "report":
            $("#reportlinkpressed").text("Kopioitu!")
            navigator.clipboard.writeText(get_csv_report())
            break;
        case "actions":
            $("#actionslinkpressed").text("Kopioitu!")
            break;
        case "killpopup":
            $(".popupbg").addClass("hideself")
            clearInterval(get_games_interval)
            break;
        case "specgamelist":
            get_games_interval = setInterval(function (){
                send_data("get_games", {});
            },10000)
            $("#gamespopup").removeClass("hideself")
            set_menu("StartupActions")
            break;
        case "doundo":
            actions.pop()
            save_game()
            load_from_actions()
            if (role === "host" || role === "editor"){
                send_data("update_actions", {"actions": actions, "request_id": -1, "last_update": last_update_from_server[0]}, true);
            }
            break;
        case "startround":
            set_action("start")
            set_menu("MainActions")
            save_game()
            break;
        case "endround":
            set_menu("EndActions")
            break;
        case "win":
            set_action("win", button_id)
            set_menu("WaitActions")
            save_game()
            break
        case "view":
            set_menu("SpectateActions")
            break
        case "spectatejoin":
            role = "spectator"
            gamecode = $("#spectate-code-input").val()
            set_menu("WaitForConnection")
            join()
            break
        case "join":
            set_menu("EditorActions")
            break
        case "editorjoin":
            role = "editor"
            gamecode = $("#editor-code-input").val()
            set_menu("WaitForConnection")
            join()
            break
        default:
            log(1,"Error with button: " +button)
    }
}
function set_action(type, param=false){
    let action;
    switch (type) {
        case "hit":
            action = {"type": type, "player": current_player, "selfhit": selfhit, "beers": [], "timestamp": Date.now()}
            let t = get_team(current_player, selfhit)
            for (let b = 0; b < teams[t]["beers"].length; b++ ){
                if (teams[t]["beers"][b]["state"] !== editing["beers"][b]["state"]){
                    action["beers"].push({"beer": b, "state": editing["beers"][b]["state"]})
                }

            }
            if (action["beers"].length > 0){
                execute_action(action)
                return true
            }
            return false
        case "win":
            action = {"type": type, "team": param, "timestamp": Date.now()}
            execute_action(action)
            break
        default:
            action = {"type": type, "timestamp": Date.now()}
            execute_action(action)
            break
    }
}

function execute_action(action){
    actions.push(action)
    if (action["type"] === "win") {
        score[action["team"]] += 1
    }
    if (action["type"] === "start") {
        start_actions.push(actions.length-1)
        init_round()
    }
    update_feed(action)
    if (role === "host" || role === "editor"){
        send_data("add_action", {'action': action, "last_update": last_update_from_server[0]}, true)
    } else if (action["type"] === "hit") {
        let team = get_team(action["player"], action["selfhit"])
        for (let b = 0; b < teams[team]["beers"].length; b++) {
            teams[team]["beers"][b]["new"] = false
        }
        for (let b = 0; b < action["beers"].length; b++) {
            let beer = action["beers"][b]
            if (teams[team]["beers"][beer["beer"]]["state"] !== beer["state"]){
                teams[team]["beers"][beer["beer"]]["new"] = true
            }
            teams[team]["beers"][beer["beer"]]["state"] = beer["state"]
            teams[team]["beers"][beer["beer"]]["player"] = action["player"]
        }
        update_beerlines()
    }
    if (action["type"] !== "hit"){
        if (start_time === 0){
            start_time = action["timestamp"]
        }
        round_time = action["timestamp"]
        set_top()
    }
}

function set_hold(button) {
    let menu = button.split("-")[0]
    let button_name = button.split("-")[1]
    let button_id = button.split("-")[2]
    if(button_name === "select"){
        holdplayer = button_id
        let holdname = teams[get_team(holdplayer)]["players"][(holdplayer-1)%3]
        $("#bottomtext").text("Jatkuva syöttö pelaajalle: " + holdname + "!")
    }

}

function init_game(reset_teams=true){
    start_actions = []
    score[0] = 0
    score[1] = 0
    if (reset_teams){
        teams = [
            {"ready": false, "teamname": "Team A", "emoji": "", "players": ["Player 1", "Player 2", "Player 3"], "beers":
            [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]},
            {"ready": false, "teamname": "Team B", "emoji": "", "players": ["Player 1", "Player 2", "Player 3"], "beers":
            [{"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}, {"state": UP, "player": null, "new": false}]}
        ]
    }
    actions = []
    init_round()
}

function init_round(){
    for (let t = 0; t < teams.length; t++ ){
        for (let b = 0; b < teams[t]["beers"].length; b++ ){
            teams[t]["beers"][b] = {"state": UP, "player": null, "new": false}
        }
    }
    selfhit = false
    update_beerlines()
}

function set_top(){
    $("#top").removeClass("hide")
    for (let t = 0; t < teams.length; t++ ){
        if ((!flip && t === 0)||(flip && t === 1)) {
            $("#left_team_name").text(teams[t]["teamname"])
            $("#left_team_emoji").text(teams[t]["emoji"])
            $("#left_team_score").text(score[t])
            $("#left_team_players").text(teams[t]["players"][0] + ", " + teams[t]["players"][1] + ", " + teams[t]["players"][2])
        } else {
            $("#right_team_name").text(teams[t]["teamname"])
            $("#right_team_emoji").text(teams[t]["emoji"])
            $("#right_team_score").text(score[t])
            $("#right_team_players").text(teams[t]["players"][0] + ", " + teams[t]["players"][1] + ", " + teams[t]["players"][2])
        }
    }
}

function set_playerbuttons(){
    $("#end-win-0").text(teams[0]["teamname"])
    $("#end-win-1").text(teams[1]["teamname"])
    for (let p = 0; p < 6; p++) {
        $("#player-select-" + p).text(get_player(p))
    }
}

function reset_game(t, a){
    let t_copy=[];
    Object.assign(t_copy, t);
    let a_copy=[];
    Object.assign(a_copy, a);
    init_game()
    teams = t_copy
    actions = a_copy
    load_from_actions(false)
}

function load_from_actions(reset=true){
    if (reset){
        init_game()
        load_game()
    }
    init_round()
    $("#feed").html("")
    $("#feed_single").html("")
    score[0] = 0
    score[1] = 0
    start_time = 0
    set_menu("WaitActions")
    set_playerbuttons()
    for (let a = 0; a < actions.length; a++){
        switch (actions[a]["type"]){
            case "hit":
                let team = get_team(actions[a]["player"],actions[a]["selfhit"])
                for (let b = 0; b < actions[a]["beers"].length; b++ ) {
                    let beer = actions[a]["beers"][b]
                    if (a === actions.length-1 && teams[team]["beers"][beer["beer"]]["state"] !== beer["state"]){
                        teams[team]["beers"][beer["beer"]]["new"] = true
                    }
                    teams[team]["beers"][beer["beer"]]["state"] = beer["state"]
                    teams[team]["beers"][beer["beer"]]["player"] = actions[a]["player"]
                }

                update_feed(actions[a])
                break
            case "start":
                start_actions.push(a)
                last_beers = []
                set_menu("MainActions")
                if (start_time === 0){
                    start_time = actions[a]["timestamp"]
                }
                round_time = actions[a]["timestamp"]
                init_round()
                update_feed(actions[a])
                break
            case "win":
                last_beers = []
                set_menu("WaitActions")
                score[actions[a]["team"]] += 1
                update_feed(actions[a])
                round_time = actions[a]["timestamp"]
                break
        }
    }
    update_beerlines()
    set_top()
}

function save_game(init=false){
    let sessions = localStorage.getItem("sessions")
    if (sessions){
        sessions = JSON.parse(sessions)
    } else {
        sessions = []
        init=true
    }
    var s = sessions.length
    while (s--) {
        if (sessions[s]["timestamp"] < Date.now() - 60*60*24*100){
            sessions.splice(s, 1);
        }
    }
    if (sessions.length === 0){
        init=true
    }
    let session = {"version": version, "actions": actions, "teams": teams, "gamecode": gamecode, "timestamp": Date.now()}
    if (init){
        sessions.push(session)
    } else {
        sessions[sessions.length-1] = session
    }
    localStorage.setItem("sessions", JSON.stringify(sessions));
}

function load_game(load_at=-1){
    let sessions = localStorage.getItem("sessions")
    if (sessions){
        sessions = JSON.parse(sessions)
    } else {
        return false
    }
    if (load_at === -1){
        session = sessions[sessions.length-1]
    } else {
        session = sessions[load_at]
    }
    if (version !== session["version"]){
        return false
    }
    actions = session["actions"]
    teams = session["teams"]
    gamecode = session["gamecode"]
    return true
}


function randomize_beers() {
    let possible_news = [[],[]]
    for (let t = 0; t < teams.length; t++ ){
        teams[t]["players"] = ["","",""]
        for (let b = 0; b < teams[t]["beers"].length; b++ ){
            let r = Math.random()
            if (r < 0.6) {
                if (Math.random() < 0.1) {
                    teams[t]["beers"][b]["state"] = FLIPPED
                } else {
                    teams[t]["beers"][b]["state"] = FALLEN
                }
                possible_news[t].push(b)
            } else {
                teams[t]["beers"][b]["state"] = UP
            }
        }
    }
    let last_team = Math.round(Math.random())
    if (possible_news[last_team].length === 0){
        last_team = (last_team -1)*-1
    }
    if (possible_news[last_team].length > 0) {
        let last = Math.ceil(Math.random() * 2.3)
        let news = []
        for (let l = 0; l < last; l++) {
            news.push(possible_news[last_team][Math.floor(Math.random()*possible_news[last_team].length)])
        }
        for (let n = 0; n < news.length; n++) {
            teams[last_team]["beers"][news[n]]["new"] = true

        }
    }
    update_beerlines()
}


function set_team_info() {
    let team = 0
    if (teams[0]["ready"]) {
        team = 1
    }
    teams[team]["ready"] = true
    teams[team]["teamname"] = $("#team-name-input").val()
    if (teams[team]["teamname"] === ""){
        teams[team]["teamname"] = texts["team"][lang] + " " + (team + 1)
    }

    teams[team]["emoji"] = $("#team-emoji-input").val()
    if (teams[team]["emoji"] === ""){
        teams[team]["emoji"] = emojis[team]
    }

    teams[team]["players"] = [$("#player-input-1").val(), $("#player-input-2").val(), $("#player-input-3").val()]
    for (let p = 0; p < teams[team]["players"].length; p++ ) {
        if (teams[team]["players"][p] === ""){
            teams[team]["players"][p] = texts["player"][lang] + " " + "ABCDEF"[team*3 + p]
        }
    }
    return team
}

function clear_inputs(title, e=0) {
    $("#team-emoji-input").attr("placeholder", emojis[e]);
    $("#team-emoji-input").val("")
    $("#team-name-input").val("")
    $("#player-input-1").val("")
    $("#player-input-2").val("")
    $("#player-input-3").val("")
    $("#SetTeamActions").find(".menutitle").text(title)
}

function set_menu(menuid) {
    lastmenu = currentmenu
    currentmenu = menuid
    $(".menu").css("display", "none");
    $("#" + menuid).css("display", "flex");
}

function set_share(){
    $("#share").removeClass("hideself")
    if (role === "host" || role === "editor"){
        $("#share_edit_row").removeClass("hideself")
        $("#sharepopup-editlink").text(gamecode.slice(0,10))
    }
    if (role === "host") {
        $("#sharepopup-public").removeClass("hideself")
    }
    $("#sharepopup-sharelink").text(gamecode.slice(0,5))
}

function hit_beer(b) {
    let bi = parseInt(b[2])
    switch (editing["beers"][bi]["state"]){
        case FALLEN:
            if (editing["beers"][bi]["new"]){
                editing["beers"][bi]["state"] = FLIPPED
                editing["beers"][bi]["new"] = false
            } else {
                return
            }
            break
        case UP:
            editing["beers"][bi]["state"] = FALLEN
            editing["beers"][bi]["new"] = true
            break
        case FLIPPED:
            editing["beers"][bi]["state"] = UP
            editing["beers"][bi]["new"] = false
            break
    }
    update_beerline(-1)
}

function get_player(id){
    return teams[Math.floor(id/3)]["players"][id%3]
}

function get_team(p, invert=false){
    let team = Math.floor(p/3)
    if (invert){
        team = (team-1)*-1
    }
    return team
}

function set_edit(t){
    editing = {
        "ready": teams[t]["ready"],
        "teamname": teams[t]["teamname"],
        "emoji": teams[t]["emoji"],
        "players": teams[t]["players"],
        "beers": [],
        "teamid": t
    }
    for (let b = 0; b < teams[t]["beers"].length; b++ ) {
        editing["beers"][b] = {
            "state": teams[t]["beers"][b]["state"],
            "player": teams[t]["beers"][b]["player"],
            "new": false,
        }
    }
}

function get_edit(t){
    for (let b = 0; b < teams[t]["beers"].length; b++ ) {
        teams[0]["beers"][b]["new"] = false
        teams[1]["beers"][b]["new"] = false
        if (teams[t]["beers"][b]["state"] !== editing["beers"][b]["state"]){
            teams[t]["beers"][b]["state"] = editing["beers"][b]["state"]
            teams[t]["beers"][b]["player"] = current_player
            teams[t]["beers"][b]["new"] = true
        }
    }
}

function update_feed(action, blink=false){
    $("#feed-text").removeClass("hideself")
    let feedline = "<div class='feedline'>"
    let feedicon;
    let max_scroll = $("#mid-scroll").prop('scrollHeight')
    let scrolled = $("#mid-scroll").scrollTop()
    let do_scroll = false
    if (max_scroll < window.innerHeight || max_scroll < scrolled+ window.innerHeight +10){
        do_scroll = true
    }
    let team;
    let teamicon;
    switch (action["type"]){
        case "hit":
            let beers = ""
            team = get_team(action["player"], false)
            let t = get_team(action["player"], action["selfhit"])
            for (let b = 0; b < teams[t]["beers"].length; b++ ) {
                let in_act = false
                let state = teams[t]["beers"][b]["state"]
                for (let ab = 0; ab < action["beers"].length; ab++ ){
                    if (b === action["beers"][ab]["beer"]) {
                        state = action["beers"][ab]["state"]
                        in_act = true
                        break
                    }
                }
                beers += "<img "
                if (!in_act){
                    beers += "class='faded' "
                }
                beers += "src='img/"
                switch (state) {
                    case UP:
                        beers += "beer.png'>"
                        break
                    case FALLEN:
                        if (in_act) {
                            beers += "hit.png'>"
                        } else {
                            beers += "grass.png'>"
                        }
                        break
                    case FLIPPED:
                        beers += "flip.png'>"
                        break
                }
            }
            teamicon = "<div class='teamicon outline'>"+teams[team]["emoji"]+"</div>"
            feedicon = "<img class='feedicon-disc' src='img/frisbee.png'>"
            if (action["selfhit"]) {
                feedicon = "<img class='feedicon-disc' src='img/selfhit.png'>"
            }
            let player = "<div class='feedplayer'>"+get_player(action["player"])+"</div>"
            feedline += "<div class='feedpadder'>-></div>" + get_time_div(action.timestamp) + teamicon + "<div class='feed_line_end'>"+player+feedicon+"<div class='feedbeer'>"+beers+"</div></div>"
            $("#feed").append(feedline)
            $("#feed_single").html("<div class='last_action'>" + texts["last_action"][lang] + "</div>" + feedline)
            break
        case "start":
            feedicon = "<img class='feedicon' src='img/start.png'>"
            feedline += get_time_div(action.timestamp, false) + feedicon + "<div class='feedtext'>" + texts["round_start"][lang] + "</div>"
            $("#feed").append(feedline)
            $("#feed_single").html("<div class='last_action'>" + texts["last_action"][lang] + "</div>" + feedline)
            break
        case "win":
            teamicon = "<div class='teamicon outline'>"+teams[action["team"]]["emoji"]+"</div>"

            feedicon = ""
            for (let s = 0; s < score[action["team"]]; s++ ) {
                feedicon += "<img class='feedicon' src='img/win.png'>"
            }
            feedline += "-> " + get_time_div(action.timestamp) + teamicon  + "<div class='feedtext'>" + texts["team"][lang] + " " + teams[action["team"]]["teamname"] + " " + texts["won"][lang] + "</div>" +feedicon
            $("#feed").append(feedline)
            $("#feed_single").html("<div class='last_action'>" + texts["last_action"][lang] + "</div>" + feedline)
            let report = get_report()
            if (report){
                feedline = "<div class='feedline'><div class='feedpadder'>-></div><div class='feedtext'>" + texts["round_duration"][lang] + " " + report["duration"] + "</div></div>"
                $("#feed").append(feedline)
                for (let p = 0; p < 6; p++) {
                    teamicon = "<div class='teamicon outline'>"+teams[get_team(p)]["emoji"]+"</div>"
                    feedline = "<div class='feedline'><div class='feedpadder'>-></div>"+teamicon+"<div class='reportplayer'>" + get_player(p) + "</div>"
                    feedline += "<div class='report_kills'>+" + report["players"][p]["kill_count"] +"</div><div class='report_multi'>"
                    let multistring = ""
                    for (let i = 1; i < 8; i++) {
                        let multi = report["players"][p]["multis"][i]
                        if (multi > 0){
                            if (multistring !== ""){
                                multistring += " + "
                            }
                            if (multi === 1){
                                multistring += (i+1)+"K"
                            } else {
                                multistring += multi + "x " + (i+1)+"K"
                            }
                        }
                    }
                    feedline += multistring + "</div><div class='report_flips'>"
                    if (report["players"][p]["flip_count"] === 1){
                        feedline += report["players"][p]["flip_count"] + " " + texts["flip"][lang]
                    }
                    if (report["players"][p]["flip_count"] > 1){
                        feedline += report["players"][p]["flip_count"] + " " + texts["flips"][lang]
                    }
                    feedline += "</div><div class='report_kills'>"
                    if (report["players"][p]["penalties"] > 0){
                        feedline += "-" + report["players"][p]["penalties"]
                    }
                    feedline += "</div></div>"
                    $("#feed").append(feedline)

                }
            }
            break

    }
    max_scroll = $("#mid-scroll").prop('scrollHeight')
    if (do_scroll){
        $("#mid-scroll").scrollTop(max_scroll-window.innerHeight)
    }
}
function test_emoji(input){
    const regex = /\p{Extended_Pictographic}/u
    let emoji = ""
    if (regex.test(input)){
        if (input.replace(regex, "") === ""){
            emoji = input
        }
    }
    return emoji
}

function get_csv_report(){
    let csv = "round,team,player,kills,flips,1K,2K,3K,4K,5K,6K,7K,8K,first,last,penalties\n"
    for (let round = 0; round < start_actions.length; round++) {
        let report = get_report(round)
        if (!report){
            break
        }
        for (let p = 0; p < 6; p++) {
            let t = get_team(p)
            let first = "FALSE"
            if (report["first"][t] === p){
                first = "TRUE"
            }
            let last = "FALSE"
            if (report["last"][t] === p){
                last = "TRUE"
            }
            let pr = report["players"][p]
            let line = [round+1, teams[t]["teamname"], get_player(p), pr["kill_count"], pr["flip_count"],
                pr["multis"][0], pr["multis"][1], pr["multis"][2], pr["multis"][3], pr["multis"][4],
                pr["multis"][5], pr["multis"][6], pr["multis"][7], first, last, pr["penalties"]]
            csv += line.join(",") +"\n"
        }
    }
    return csv
}

function get_report(round=-1){
    if (round < 0) {
        round = start_actions.length + round
    }
    let report = {"start": actions[start_actions[round]]["timestamp"], "end":0, "duration": "", "players": [], "first":[-1,-1], "last": [-1,-1]}
    for (let p = 0; p < 6; p++) {
        report["players"].push({"kill_count": 0, "flip_count": 0, "multis": [0,0,0,0,0,0,0,0], "penalties": 0})
    }
    let teamkills = [0,0]
    for (let a = start_actions[round]+1; a < actions.length; a++) {
        if (actions[a]["type"] === "hit") {
            let flips = 0
            let kills = 0
            for (let ab = 0; ab < actions[a]["beers"].length; ab++) {
                switch (actions[a]["beers"][ab]["state"]) {
                    case FALLEN:
                        kills += 1
                        break
                    case UP:
                        flips += 1
                        break
                    case FLIPPED:
                        flips += 1
                        break
                }
            }
            let team = get_team(actions[a]["player"])
            if (actions[a]["selfhit"]) {
                report["players"][actions[a]["player"]]["penalties"] += kills
            } else {
                report["players"][actions[a]["player"]]["kill_count"] += kills
                report["players"][actions[a]["player"]]["flip_count"] += flips
                if (kills > 0) {
                    if (teamkills[team] === 0){
                        report["first"][team] = actions[a]["player"]
                    }
                    teamkills[team] += kills
                    if (teamkills[team] === 8){
                        report["last"][team] = actions[a]["player"]
                    }
                    report["players"][actions[a]["player"]]["multis"][kills - 1] += 1
                }
            }
        } else if (actions[a]["type"] === "win"){
            report["end"] = actions[a]["timestamp"]
            break
        }
    }
    if (report["end"] !== 0){
        let diffTime = Math.abs(report["end"] - report["start"]);
        hours = Math.floor(diffTime / (1000 * 60 * 60)).toString().padStart(2,"0");
        minutes = (Math.floor(diffTime / (1000 * 60))%60).toString().padStart(2,"0");
        seconds = (Math.floor(diffTime / (1000))%60).toString().padStart(2,"0");
        report["duration"] = hours+":"+minutes+":"+seconds
        return report
    }
    return false

}

function get_time_div(timestamp, from_start=true){
    let hours
    let minutes
    let seconds
    if (from_start){
        let diffTime = Math.abs(timestamp - round_time);
        hours = Math.floor(diffTime / (1000 * 60 * 60)).toString().padStart(2,"0");
        minutes = (Math.floor(diffTime / (1000 * 60))%60).toString().padStart(2,"0");
        seconds = (Math.floor(diffTime / (1000))%60).toString().padStart(2,"0");
    } else{
        let dt = new Date();
        timestamp -= dt.getTimezoneOffset()*60*1000
        hours = Math.floor(timestamp / (1000 * 60 * 60)%24).toString().padStart(2,"0");
        minutes = (Math.floor(timestamp / (1000 * 60))%60).toString().padStart(2,"0");
        seconds = (Math.floor(timestamp / (1000))%60).toString().padStart(2,"0");
    }

    let clock = '<div class="clock">'
    if (from_start) {
        clock = '<div class="clock">'
    } else {
        clock = '<div class="clock realtime"><div>' + hours[0] + '</div>'
    }
    clock += '<div>'+hours[1]+'</div>' +
        '<div class="separator">:</div>' +
        '<div>'+minutes[0]+'</div>' +
        '<div>'+minutes[1]+'</div>' +
        '<div class="separator">:</div>' +
        '<div class="seconds">'+seconds[0]+'</div>' +
        '<div class="seconds">'+seconds[1]+'</div>' +
        '</div>'
    return clock
}

function update_beerlines() {
    update_beerline(0)
    update_beerline(1)
}
function do_editline_tilt(e, line){
    for (let b = 0; b < 8; b++ ) {
        if ((e["teamid"] === 0 && !flip)||(e["teamid"] === 1 && flip)){
            $(line[b]).css("margin-top", (b*0.8) +"vw")
        } else{
            $(line[b]).css("margin-top", ((7-b)*0.8) +"vw")
        }
    }

}
function update_beerline(t) {
    let line = []
    let team
    if (t === -1){
        team = editing
        line = $("#blP").children().toArray();
        do_editline_tilt(team, line)
    } else {
        team = teams[t]
        if ((flip && t === 0)||(!flip && t === 1)) {
            line = $("#blL").children().toArray();
            line = line.reverse()
        } else {
            line = $("#blR").children().toArray()
        }
    }
    for (let b = 0; b < team["beers"].length; b++ ){
        $(line[b]).children().hide()
        let beer = team["beers"][b]
        switch (beer["state"]) {
            case FALLEN:
                $(line[b]).find(".grass").show()
                break
            case UP:
                $(line[b]).find(".beer").show()
                break
            case FLIPPED:
                $(line[b]).find(".flip").show()
                break
        }
        if (beer["new"]){
            $(line[b]).find(".hit").show()

        }
        $(line[b]).find(".actor").show()
        let beer_text = ""
        if (beer["player"]){
            beer_text = get_player(beer["player"])
        }
        $(line[b]).find(".actor").text(beer_text)
    }
}
