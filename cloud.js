const AV = require('leanengine');
const rp = require('request-promise');
const qs = require('querystring');

const Message = AV.Object.extend('Message');

/**
 * 留言点赞数的增加与减少
 */
AV.Cloud.define('messageLike', function (request) {
  if (!request.currentUser) throw new AV.Cloud.Error('没有登陆', { code: 301 });
  if (!request.params.id) throw new AV.Cloud.Error('没有 data id', { code: 302 });

  const query = AV.Query(Message);
  return query.get(request.params.id).then(data => {
    let likeUsers = data.get('likeUsers') && data.get('likeUsers').split(',');
    if (!likeUsers || likeUsers.length === 0) {
      data.increment('like', 1);
      data.set('likeUsers', request.currentUser.id);
    } else {
      if (likeUsers.indexOf(request.currentUser.id) === -1) {
        // 没有点击过，增加
        likeUsers.push(request.currentUser.id);
        data.increment('like', 1);
        data.set('likeUsers', likeUsers.join(','));
      } else {
        // 点击过了,减少
        data.increment('like', -1);
        likeUsers.splice(likeUsers.indexOf(request.currentUser.id), 1)
        data.set('likeUsers', likeUsers.join(','));
      }
    }

    return data.save();
  }).catch(error => {
    throw new AV.Cloud.Error('服务器内部出错', { code: 300 });
  });
});


/**
 * 文章点赞
 */
AV.Cloud.define('atricleLike', function (request) {
  if (!request.currentUser) throw new AV.Cloud.Error('没有登陆', { code: 301 });
  if (!request.params.id) throw new AV.Cloud.Error('没有 atricle id', { code: 302 });

  const query = new AV.Query('Atricle');

  return query.get(request.params.id).then(data => {
    let likeUsers = data.get('likeUsers') && data.get('likeUsers').split(',');
    if (!likeUsers || likeUsers.length === 0) {
      data.increment('like', 1);
      data.set('likeUsers', request.currentUser.id);
    } else {
      if (likeUsers.indexOf(request.currentUser.id) === -1) {
        // 没有点击过，增加
        likeUsers.push(request.currentUser.id);
        data.increment('like', 1);
        data.set('likeUsers', likeUsers.join(','));
      } else {
        // 点击过了,减少
        data.increment('like', -1);
        likeUsers.splice(likeUsers.indexOf(request.currentUser.id), 1)
        data.set('likeUsers', likeUsers.join(','));
      }
    }

    return data.save();
  }).catch(error => {
    throw new AV.Cloud.Error('服务器内部出错', { code: 300 });
  });
});



/**
 * 文章留言
 */
AV.Cloud.define('atricleMessage', function (request) {
  if (!request.currentUser) throw new AV.Cloud.Error('没有登陆', { code: 301 });
  if (!request.params.atricleId) throw new AV.Cloud.Error('没有 atricle id', { code: 302 });
  if (!request.params.message) throw new AV.Cloud.Error('没有 message id', { code: 303 });

  // 创建留言
  const atricle = AV.Object.createWithoutData('Atricle', request.params.atricleId);
  const mes = new Message();
  mes.set('message', request.params.message);
  mes.set('atricle', atricle);
  mes.set('user', request.currentUser);
  mes.save().then(() => {
    // 文章留言数字+1
    atricle.increment('messageCount', 1);
    return atricle.save().id;
  }).catch((error) => {
    throw new AV.Cloud.Error('服务器内部出错', { code: 300 });
  });
})

/**
 * 用 GitHub 第三方登陆
 * 登陆时候更新 github 数据
 * 返回 access_token 与 githubId
 */
AV.Cloud.define('gitHubOauth', { fetchUser: false }, function (request) {
  if (!request.params.code) throw new AV.Cloud.Error('没有 code', { code: 301 });
  const url = 'https://github.com/login/oauth/access_token'
    + '?client_id=' + process.env.github_client_id
    + '&client_secret=' + process.env.github_client_secret
    + '&redirect_uri=https://vscode.liangtongzhuo.com/oauth.html&code='
    + request.params.code + '';

  let access_token, data, userId, G_error, requestUserId = request.params.state || 0;
  // 换取 access_token
  return rp({
    method: 'POST',
    url
  }).then(body => {
    access_token = qs.parse(body).access_token;
    // access_token 换取个人信息    
    return rp({
      url: 'https://api.github.com/user',
      headers: {
        'User-Agent': 'Awesome-Octocat-App',
        'Authorization': 'token ' + access_token
      }
    });
  }).then(body => {
    data = JSON.parse(body);
    // 根据个人信息查询，以前是否已经有注册的账号 
    // 组合查询
    const users1 = new AV.Query('_User');
    users1.equalTo('username', data.email);
    const users2 = new AV.Query('_User');
    users2.equalTo('_id', requestUserId);
    var query = AV.Query.or(users1, users2);
    return query.find();
  }).then(users => {
    if (users && users.length > 0) {
      userId = users[0].id;
      return users[0];
    }
    // 如果以前没有则创建
    return AV.User.signUpOrlogInWithAuthData({
      'uid': data.id + '',
      'access_token': access_token
    }, 'github');
  }).then(user => {
    userId = user.id;
    // 给创建的账号设置信息
    user.set('name', name(data.name));
    user.set('email', data.email);
    user.set('username', data.email);
    user.set('blog', data.blog);
    user.set('bio', data.bio);
    user.set('github_url', data.html_url);
    user.set('avatar_url', data.avatar_url);
    user.set('authData', {
      github: {
        uid: data.id + '',
        access_token
      }
    });
    return user.save();
  }).catch((error) => {
    if (error.code === 137 && userId) {
      G_error = true
      // 代表名字重复了      
      var _user = new AV.Query('_User');
      return _user.get(userId);
    } else {
      throw new AV.Cloud.Error('服务器内部', { code: 300 });
    }
  }).then(user => {
    if (G_error) {
      user.set('name', name(data.name) + (new Date()).valueOf());
      user.set('username', data.email);
      user.set('email', data.email);
      user.set('blog', data.blog);
      user.set('bio', data.bio);
      user.set('github_url', data.html_url);
      user.set('avatar_url', data.avatar_url);
      user.set('authData', {
        github: {
          uid: data.id + '',
          access_token
        }
      });
      return user.save();
    }
    return;
  }).then(_ => {
    return {
      access_token,
      uid: data.id + ''
    };
  }).catch((error) => {
    console.log(error.message)
    throw new AV.Cloud.Error('服务器内部', { code: 300 });
  });
});

// 名字内有空格与@都去掉
function name(name) {
  let str = '';
  for (let i = 0; i < name.length; i++) {
    const s = name[i];
    if (s !== '@' && s !== ' ') {
      str += s;
    }
  }

  return str;
}