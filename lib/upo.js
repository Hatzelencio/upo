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
    var fs = require('fs-extra');
    var projects = atom.project.getPaths();

    for(var i in projects){
      var config = projects[i].concat('/upo-config.json');

      try{
        fs.accessSync(config, fs.F_OK);
      }catch(err){
        fs.copySync( __dirname.concat('/upo-config-exqueleton.json'), config);
        this.displayInfoNotify(this.msgNotifications.info.M01);
      }
    }
  },

  uploadSingleFile() {
    self = this;
    try{
      var currentDir = this.getCurrentProjectDir();
      if(currentDir == null){
        throw(this.msgNotifications.error.M02);
      }
    }catch(err){
      return this.displayErrorNotify(null, err);
    }

    try{
      var currentFile = this.getCurrentFilePath();
      if(currentFile == null){
        throw(this.msgNotifications.warning.M02);
      }
    }catch(err){
      return this.displayWarningNotify(err);
    }

    try{
      var fs = require('fs-extra');
      var cnf = JSON.parse(fs.readFileSync(currentDir.concat('/upo-config.json'), 'utf8'));
    }catch(err){
      console.log(err);
      return this.displayWarningNotify(this.msgNotifications.warning.M03);
    }

    var remoteFile = cnf.remotePath + currentFile.substring(currentDir.length, currentFile.length);
    dirRemotePath = require('path').dirname(remoteFile);

    var objCmd = this.createCmdConnection(cnf, currentFile, dirRemotePath);

    cnf.ssh = objCmd.ssh;
    cnf.scp = objCmd.scp;

    this.existsRemoteDir(dirRemotePath, cnf, function(exists){
      if(exists){
        self.exec(objCmd.scp, function(stdout, err) {
          if(stdout != null){
            self.displaySuccessNotify(self.msgNotifications.success.M01);
          }else{
            self.displayErrorNotify(err);
          }
        });
      }else{
        self.createRemoteDir(dirRemotePath, cnf, function() {
          self.exec(objCmd.scp, function(stdout, err) {
            if(stdout != null){
              self.displaySuccessNotify(self.msgNotifications.success.M01);
            }else{
              self.displayErrorNotify(err);
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

  createCmdConnection(cnf, currentFile, dirRemotePath){
    var scpConnection = (cnf.sshKeyFile == null) ?
      'sshpass -p "' + cnf.pass + '" scp ' + currentFile + ' ' + cnf.user + '@' + cnf.host + ':' + dirRemotePath :
      'scp -i ' + cnf.sshKeyFile + ' ' + currentFile + ' ' + cnf.user + '@' + cnf.host + ':' + dirRemotePath;

    var sshConnection = (cnf.sshKeyFile == null) ?
      'sshpass -p "' + cnf.pass + '" ssh ' + cnf.user + '@' + cnf.host + ' ' :
      'ssh -i ' + cnf.sshKeyFile + ' ' + cnf.user + '@' + cnf.host + ' ';

    return {scp: scpConnection, ssh: sshConnection};
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
        throw(this.msgNotifications.error.M01);
      }

      return null;
  },

  getCurrentFilePath(){
      try{
        return atom.workspace.getActivePaneItem().buffer.file.path;
      }catch(err){
        throw(this.msgNotifications.warning.M01);
      }

      return null;
  },

  existsRemoteDir(remoteDir, upoConfig, callback){
    var cmd = upoConfig.ssh + '[ -d ' + remoteDir + ' ] && echo 1 || echo 0' ;
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
    var cmd = upoConfig.ssh + 'mkdir -p ' + remoteDir;
    self.exec(cmd, function(stdout, err) {
      callback();
    });
  },

/**
 * Notificaciones
 */
  msgNotifications: {
    success: {
      M01: '> ¡Archivo Subido! \\ :v /\n\nEl archivo se ha subido con éxito.'
    },
    info: {
      M01: '> ¡Archivo Creado! \\ :v /\n\nSe creó un archivo de configuración.\nRevisa la raíz de tu proyecto.'
    },
    warning: {
      M01: '> ¡Alto ahí Rufian! :v\n\nNo se encontró la ruta del archivo actual.',
      M02: '> ¡Baia baia! :v\n\nNo existe el archivo.',
      M03: '> ¡Nel prro! :v\n\nNo se encontró `upo-config.json` en la raíz del proyecto.\n\nDeberías de crearlo.'
    },
    error: {
      M01: '> ¡Denunciado! >:v\n\nNo se encontró la carpeta del proyecto. **-10**',
      M02: '> ¡No hay proyectos! >:v\n\nNel perro.'
    }
  },

  displaySuccessNotify(msg){
    atom.notifications.addSuccess('Upo', {
      description: msg,
      icon: 'check'
    });
  },

  displayInfoNotify(msg){
    atom.notifications.addInfo('Upo', {
      description: msg,
      icon: 'info'
    });
  },

  displayWarningNotify(msg){
    atom.notifications.addWarning('Upo', {
      dismissable: false,
      description: msg,
      icon: 'alert'
    });
  },

  displayErrorNotify(err, msg){
    atom.notifications.addError('Upo', {
      dismissable: true,
      description: msg,
      detail: err,
      icon: 'flame'
    });
  }
};
