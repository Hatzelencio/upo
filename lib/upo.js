'use babel';

import { CompositeDisposable } from 'atom';

export default {

  exqueleton: require('./upo-config-exqueleton.json'),
  subscriptions: null,

  "config": {
    "timeoutConsole": {
      "title": "Timeout to upload file",
      "description": "...in seconds",
      "type": "integer",
      "default": 10,
      "minimum": 0
    }
  },

  activate(state) {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'upo:create-config-file': () => this.createConfigFile()
    }));

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'upo:upload-single-file': () => this.uploadSingleFile()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

/**
 * Upo - Actions
 */
  createConfigFile(){
    var self = this;
    var fs = require('fs-extra');
    var projects = atom.project.getPaths();

    for(var i in projects){
      var config = projects[i].concat('/upo-config.json');

      try{
        fs.accessSync(config, fs.F_OK);
      }catch(err){
        fs.copySync( __dirname.concat('/upo-config-exqueleton.json'), config);
        self.displayInfoNotify('Se creó un archivo de configuración.');
      }
    }
  },

  uploadSingleFile() {
    self = this;
    try{
      var currentDir = this.getCurrentProjectDir();
      if(currentDir == null){
        throw('> ¡No hay proyectos! >:v\n\nNel perro.');
      }
    }catch(err){
      return this.displayErrorNotify(err, '[SAD]');
    }

    try{
      var currentFile = this.getCurrentFilePath();
      if(currentFile == null){
        throw('> ¡No existe el archivo! >:v\n\nNel perro.');
      }
    }catch(err){
      return this.displayWarningNotify(err);
    }

    try{
      var fs = require('fs-extra');
      var cnf = JSON.parse(fs.readFileSync(currentDir.concat('/upo-config.json'), 'utf8'));
    }catch(err){
      console.log(err);
      return this.displayWarningNotify('> Izi pz >:v\n\nNo se encontró `upo-config.json` en la raíz del proyecto.');
    }

    var remoteFile = cnf.remotePath + currentFile.substring(currentDir.length, currentFile.length);
    dirRemotePath = require('path').dirname(remoteFile);

    var cmd = 'sshpass -p "' + cnf.pass + '" scp ' + currentFile + ' ' + cnf.user + '@' + cnf.host + ':' + dirRemotePath;


    self.existsRemoteDir(dirRemotePath, cnf, function(exists){
      if(exists){
        self.exec(cmd, function(stdout, err) {
          if(stdout != null){
            self.displaySuccessNotify('Su archivo se subió con éxito.');
          }else{
            self.displayErrorNotify('[exec]', err);
          }
        });
      }else{
        self.createRemoteDir(dirRemotePath, cnf, function() {
          self.exec(cmd, function(stdout, err) {
            if(stdout != null){
              self.displaySuccessNotify('Su archivo se subió con éxito.');
            }else{
              self.displayErrorNotify('[exec]', err);
            }
          });
        });
      }
    });
  },

  exec(command, callback){
    var exec = require('child_process').exec;
    exec(command, {
      timeout: atom.config.get('upo.timeoutConsole') * 1000
    },function (error, stdout, stderr) {
      if (error !== null) {
        callback(null, error);
      }else{
        callback(stdout, null);
      }
    });
  },

  getCurrentProjectDir(){
      try{
        path   = require('path');
        editor = atom.workspace.getActivePaneItem();
        dirPath = path.dirname(editor.buffer.file.path);

        var projects = atom.project.getPaths();
        for(var i in projects){
          if(dirPath.startsWith(projects[i])){
            return projects[i];
          }
        }
      }catch(err){
        throw('> ¡Alto ahí Rufian! >:v\n\nNo se encontró la carpeta del proyecto.');
      }

      return null;
  },

  getCurrentFilePath(){
      try{
        return atom.workspace.getActivePaneItem().buffer.file.path;
      }catch(err){
        throw('> ¡Alto ahí Rufian! >:v\n\nNo se encontró la ruta del archivo actual.');
      }

      return null;
  },

  existsRemoteDir(remoteDir, upoConfig, callback){
    var cmd = 'sshpass -p "' + upoConfig.pass + '" ssh ' + upoConfig.user + '@' + upoConfig.host + ' [ -d ' + remoteDir + ' ] && echo 1 || echo 0' ;
    this.exec(cmd, function(stdout, err) {

      console.log(stdout);
      if(stdout == 1){
        callback(true);
      }else{
        callback(false);
      }
    });
  },

  createRemoteDir(remoteDir, upoConfig, callback){
    var cmd = 'sshpass -p "' + upoConfig.pass + '" ssh ' + upoConfig.user + '@' + upoConfig.host + ' mkdir -p ' + remoteDir;
    self.exec(cmd, function(stdout, err) {
      callback();
    });
  },

/**
 * Notificaciones
 */
  displaySuccessNotify(msg){
    atom.notifications.addSuccess('upo', {
      detail: msg,
      icon: 'check'
    });
  },

  displayInfoNotify(msg){
    atom.notifications.addInfo('upo', {
      detail: msg,
      icon: 'info'
    });
  },

  displayWarningNotify(msg){
    atom.notifications.addWarning('upo', {
      dismissable: false,
      description: msg,
      icon: 'flame'
    });
  },

  displayErrorNotify(err, desc){
    atom.notifications.addError('upo', {
      dismissable: true,
      description: err,
      detail: desc,
      icon: 'flame'
    });
  }
};
