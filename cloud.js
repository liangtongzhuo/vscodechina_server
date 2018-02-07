const AV = require('leanengine');
var rp = require('request-promise');
var qs = require('querystring');
/**
 * 留言点赞数的增加与减少
 */
AV.Cloud.define('messageLike', function (request) {
  if (!request.currentUser) throw new AV.Cloud.Error('没有登陆', { code: 301 });
  if (!request.params.id) throw new AV.Cloud.Error('没有 data id', { code: 302 });

  const query = new AV.Query('Message');

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
  const Message = AV.Object.extend('Message');
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
AV.Cloud.define('gitHubOauth', function (request) {
  if (!request.params.code) throw new AV.Cloud.Error('没有 code', { code: 301 });
  const url = 'https://github.com/login/oauth/access_token'
    + '?client_id=538a8b0fb32787b493c7'
    + '&client_secret=9bb2b07e4b4bada9c816b7d5ab93245aa78bb840'
    + '&redirect_uri=http://127.0.0.1:3000/other/login&code='
    + request.params.code;

  let access_token, data
  // 换取 access_token
  return rp({
    method: 'POST',
    url
  }).then(body => {
    access_token = qs.parse(body).access_token;
    // access_token 换取个人信息    
    return rp({
      url: 'https://api.github.com/user?access_token=' + access_token,
      headers: {
        'User-Agent': 'Awesome-Octocat-App'
      }
    });
  }).then(body => {
    data = JSON.parse(body);
    // 根据个人信息查询，以前是否已经有注册的账号了
    var user = new AV.Query('_User');
    user.equalTo('email', data.email);
    return user.find();
  }).then(user => {
    if (user && user.length) {
      return user[0];
    }
    // 如果以前没有则创建
    return AV.User.signUpOrlogInWithAuthData({
      'uid': data.id + '',
      'access_token': access_token
    }, 'github');
  }).then(user => {
    // 给创建的账号设置信息
    user.set('name', data.name);
    user.set('username', data.email);
    user.set('email', data.email);
    user.set('blog', data.blog);
    user.set('bio', data.bio);
    user.set('uid', data.id);
    user.set('avatar_url', data.avatar_url);
    return user.save();
  }).then(result => {
    return {
      access_token,
      openid: data.id
    };
  }).catch((error) => {
    console.log(error.message)
    throw new AV.Cloud.Error('服务器请求失败', { code: 302 });
  });
});


