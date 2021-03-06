'use strict';

/* Copyright 2015 Lucas Vasconcelos

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */


var TelegramBot = require('node-telegram-bot-api');
var token = process.argv[2];
var bot = new TelegramBot(token, {polling: true});

var request = require("request");

var botan = require('botanio')(process.argv[3]);

var steamList = require('./app/models/steamlist');
var mongoose = require('mongoose');
mongoose.connect(process.argv[4]);

let globalText =
    `Sou um bot que envia as últimas notícias dos mais diversos sites de tecnologia! Conheça nosso canal no Telegram: @pcfacts
      |Comandos:
      |  /wccf
      |  /tecmundo
      |  /gamespot
      |  /adrenaline
      |  /pcper
      |  /extremetech
      |  /steamlist
    Se deseja mandar alguma sugestão ou elogio entre em contato com @vasconcelos ;)`;

var feedList = {
    'adrenaline':{
        'main': { 'url': 'http://adrenaline.uol.com.br/rss/0/0/tudo.xml' }
    },
    'wccf':{
        'main': { 'url': 'http://feeds.feedburner.com/feedburner/lrTPj' }
    },
    'tecmundo':{
        'main': { 'url': 'http://rss.tecmundo.com.br/feed' },
        'games': { 'url': 'http://rss.tecmundo.com.br/games/feed' }
    },
    'gamespot':{
        'main': { 'url': 'http://www.gamespot.com/feeds/mashup/' },
        'reviews': { 'url': 'http://www.gamespot.com/feeds/reviews/' }
    },
    'pcper':{
        'main': { 'url': 'http://www.pcper.com/feed' }
    },
    'extremetech':{
        'main': { 'url': 'http://www.extremetech.com/feed' }
    }
};


bot.onText(/\/steamlist (.+)?/, function (msg, match) {
    var params = match[1];
    if(params){
        switch(params){
            case 'del':
                deleteFromList(msg);
                break;
            default:
                addUserToList(msg, params);
                break;
        }
    }
    botan.track(message, 'steamlist');
});

bot.onText(/^\/steamlist$/, function (msg, match) {
    sendSteamList(msg);
    botan.track(message, 'steamlist');
});

bot.onText(/^\/steamlist@PCFactsBot$/, function (msg, match) {
    sendSteamList(msg);
    botan.track(message, 'steamlist');
});

bot.onText(/\/ajuda/, function (msg, match) {
    bot.sendMessage(msg.chat.id, globalText);
    botan.track(message, 'help');
});

bot.onText(/\/help/, function (msg, match) {
    bot.sendMessage(msg.chat.id, globalText);
    botan.track(message, 'help');
});

bot.onText(/\/start/, function (msg, match) {
    bot.sendMessage(msg.chat.id, globalText);
    botan.track(message, 'start');
});


bot.onText(/\/([a-z]+)/, function (msg, match) {
    var cmdString = match[1].split(" ");
    var feedStream = cmdString[1] ? cmdString[1] : 'main';
    var selectedFeed = feedList[cmdString[0]][feedStream];
    if(selectedFeed){
            sendLastNews(msg, selectedFeed);
            botan.track(message, cmdString[1]);
    }
});

/* função que envia a lista de ID's da Steam */

function sendSteamList(msg) {
    var sendList = "Lista de ID's Steam do grupo \"" + msg.chat.title + "\"\n\n";
    steamList.find({
        chatid: msg.chat.id
    }, function(err, list) {
        if (err)
            console.log(err);
        if (list.length > 0) {
            for (var i in list) {
                sendList += list[i].name + "(" + list[i].username + ")" + ": " + list[i].steamid + "\n";
            }
            sendList += "\n\nPara adicionar sua ID Steam no grupo digite: /steamlist SUAID"
        } else {
            sendList = "Esse grupo ainda não possui ID's Steam cadastradas :(";
        }
        bot.sendMessage(msg.chat.id, sendList);
    });
}

/* função que deleta um usuário da lista de ID's Steam de um grupo */

function deleteFromList(msg) {
    steamList.findOne({
        chatid: msg.chat.id,
        userid: msg.from.id
    }, function(err, list) {
        if (!list) {
            bot.sendMessage(msg.chat.id, 'Você não está na lista :(');
        } else {
            steamList.remove({
                chatid: msg.chat.id,
                userid: msg.from.id
            }, function(err) {
                if (err)
                    console.log(err);
            });
            bot.sendMessage(msg.chat.id, 'Sua ID Steam foi excluída! ;)');
        }
    });
}

/* função que adiciona ou atualiza a ID Steam ao grupo */

function addUserToList(msg, params) {
    steamList.findOne({
        chatid: msg.chat.id,
        userid: msg.from.id
    }, function(err, list) {
        if (!list) {
            newSteamID = new steamList();
            newSteamID.userid = msg.from.id,
            newSteamID.chatid = msg.chat.id,
            newSteamID.steamid = params,
            newSteamID.name = msg.from.last_name ? msg.from.first_name + " " + msg.from.last_name : msg.from.first_name,
            newSteamID.username = (msg.from.username) ? msg.from.username : "x";
            newSteamID.save(function(err) {
                if (err)
                    console.log(err);
                bot.sendMessage(msg.chat.id, 'Sua ID Steam foi adicionado ao grupo! ;)');
            });
        } else {
            steamList.update({
                chatid: msg.chat.id,
                userid: msg.from.id
            }, {
                $set: {
                    steamid: params
                }
            }, function(err) {
                if (err)
                    console.log(err);
            });
            bot.sendMessage(msg.chat.id, 'Sua ID Steam foi atualizada! ;)');
        }
    });

}
/* envia a última noticia do feed passado pelo objeto feedList */
function sendLastNews(msg, feed) {
    request({
        url: 'http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&q=' + feed.url,
        json: true
    }, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            var lastNews = body.responseData.feed.entries[0];
            bot.sendMessage(msg.chat.id, lastNews.contentSnippet + '\n' + lastNews.link);
        }
    });
}
