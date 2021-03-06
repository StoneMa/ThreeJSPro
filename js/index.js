var canvas = document.getElementById("number");

var container;
var particleMaterial;
var raycaster;
var mouse;
var objects = [];

// three.js
var camera, scene, renderer;
var controls = void 0;
var sprite = void 0;
var mesh = void 0;
var objLoader = void 0;
var spriteBehindObject = void 0;

var anno_data;
function loadAnnos() {
    $.ajax({
        type: 'post',
        url: './queryAnnos.do',
        success: function (data) {
            if (data != null){
                anno_data = data;
                createExsitAnnos();
            }
        }
    })
}
var existAnnos = [];

function createExsitAnnos() {
    for (var j = 0; j < anno_data.length; j++){
        var e_div; // 创建anno content的div
        var sp;
        var strong;
        var p;
        sp = document.createElement('p');
        strong = document.createElement('strong');
        p = document.createElement('p');
        strong.type = 'text';
        e_div = document.createElement('div');
        e_div.className = 'annos';
        e_div.style.background = 'rgba(0, 0, 0, 0.8)';
        document.body.appendChild(e_div);
        existAnnos.push(e_div);
        strong.innerHTML = anno_data[j].title;
        p.innerHTML = anno_data[j].content;
        sp.appendChild(strong);
        sp.append(p);
        e_div.appendChild(sp);
        $(e_div).attr('data-attr', anno_data[j].id);//操作伪dom中的内容，但是不能使用类选择器
        /*
        $(e_div).on('click', function hideExistAnno() {
            $(e_div).find("*").toggle('fast');
        })
        */
        (function(e){
            $(e).on('click', function hideExistAnno() {
                $(e).find("*").toggle('fast');
                if (e.style.background != '') {
                    e.style.background = '';
                } else {
                    e.style.background = 'rgba(0, 0, 0, 0.8)';
                }
            });
        })(e_div)

    }
}
// 例子，annotation写法
// var annotation = document.querySelector(".annotation"); //第一个annotation

// var intersects = new Array();
var stats;
init();
animate();
// 对于已经存在于数据库中的点，初始化的过程中要把点重新加入到模型当中
function init() {

    //初始化统计对象
/*    stats = initStats();
    function initStats() {
        var stats = new Stats();
        //设置统计模式
        stats.setMode(0); // 0: fps, 1: ms
        //统计信息显示在左上角
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.left = '0px';
        stats.domElement.style.top = '0px';
        //将统计对象添加到对应的<div>元素中
        document.getElementById("Stats-output").appendChild(stats.domElement);
        return stats;
    }*/
    container = document.createElement('div');
    document.body.appendChild(container);

    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(750, 500, 1200);

    var PI2 = Math.PI * 2;
    particleMaterial = new THREE.SpriteMaterial({
        alphaTest: 0.5,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        color: 0x000000
    });
    // Scene
    scene = new THREE.Scene();
    // Lights
    var lights = [];

    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[1] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(1000, 2000, 1000);
    lights[1].position.set(-1000, -2000, -1000);

    scene.add(lights[0]);
    scene.add(lights[1]);

    // Mesh

    var cubeGeometry = new THREE.BoxGeometry(500, 500, 500);

    mesh = new THREE.Mesh(cubeGeometry, new THREE.MeshPhongMaterial({
        color: 0x156289,
        emissive: 0x072534,
        side: THREE.DoubleSide,
        shading: THREE.FlatShading
    }));

    // Sprite
    // 创建一个永远朝向屏幕方向的sprite
    var numberTexture = new THREE.CanvasTexture(document.querySelector("#number"));

    sprite = new THREE.Sprite();
    sprite.position.set(0, 0, 100);
    sprite.scale.set(60, 60, 10);

    scene.add(sprite);

    // 射线投影器
    raycaster = new THREE.Raycaster(); // 射线投射器
    mouse = new THREE.Vector2(); // 二维鼠标向量

    // Renderer

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0.5);
    container.appendChild(renderer.domElement);
    document.body.appendChild(renderer.domElement);

    //  objLoader

    objLoader = new THREE.OBJLoader();
    objLoader.setPath('./obj/');
    objLoader.load('zxj.obj', function (object) {

        object.traverse(function (child) {
            if (child.type === "Mesh") {
                child.geometry.computeBoundingBox();
                child.geometry.verticesNeedUpdate = true;
                child.material.side = THREE.DoubleSide;
            }

        });
        object.name = "zxj";  //设置模型的名称
        object.position.x = -100;//载入模型的时候的位置
        object.position.y = 0;
        object.position.z = -500;

        object.scale.x = 0.001;
        object.scale.y = 0.001;
        object.scale.z = 0.001;
        //写入场景内
        scene.add(object);
        objects.push(object);//仿照ThreeJS写法

    });
    // Controls
    initControl();
    loadAnnos(); // 初始化节点
    $('#test').click(onDocumentMouseDown);
   //document.addEventListener('mousedown', onDocumentMouseDown, false); // 这里是个坑啊，一定要注意 鼠标单击事件如果绑定给全局document，其他需要鼠标单击的控件，全部失效
    document.addEventListener('touchstart', onDocumentTouchStart, false);
    document.addEventListener('dblclick', ondblClick, false);
    window.addEventListener("resize", onWindowResize, false);
}


/**
 * 鼠标双击事件，添加热点
 * 实现应该是双击某点后添加热点，并提示添加注释
 * 步骤：1、双击某处；记录camera位置
 *      2、 声明一个annotation
 *      3、 在页面创建标签并绑定
 *      4、 添加样式和事件
 * @param {*} event 
 */
var rays = []; //记录多次双击之后的射线
var annos = new Array(); //热点定义成数组
var intersects;
function ondblClick(event) {
    var clientX;
    var clientY;
    event.preventDefault();
    console.log('获取屏幕坐标：');
    clientX = event.clientX;
    clientY = event.clientY;
    console.log(clientX);
    console.log(clientY);
    // 获取到鼠标点击的位置的坐标
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1; //获取鼠标点击的位置的坐标
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    console.log('转换后的设备坐标（即屏幕标准化后的坐标从 -1 到 +1）：');
    console.log(mouse.x);
    console.log(mouse.y);
    raycaster.setFromCamera(mouse, camera);//从相机发射一条射线，经过鼠标点击位置 mouse为鼠标的二维设备坐标，camera射线起点处的相机
    // intersects 是后者的返回对象数组，
    intersects = raycaster.intersectObjects(objects[0].children, false); //intersects是交点数组，包含射线与mesh对象相交的所有交点
    //intersects.push(raycaster.intersectObjects(objects[0].children)); //intersects是交点

    /* 如果射线与模型之间有交点，才执行如下操作 */
    if (intersects.length > 0) {
        if (annos.length > 20){
            alert("到达热点上限");
            return;
        }
        else {
            $('#myModal').modal(); //调用模态框
            /**
             *  向模型上标记点
             */
            // 选中mesh
            //intersects[0].object.material.color.setHex(Math.random() * 0xffffff);
            // var particle = new THREE.Sprite(particleMaterial);
            // particle.position.copy(intersects[0].point);
            // particle.scale.x = particle.scale.y = 0; // 控制鼠标双击的位置和模型的交点处粒子的大小
            //scene.add(particle); //这里是控制这个粒子是否加入到场景中（就是鼠标点击模型上会出现一个小方块）
            //加载模态框
            rays.push(intersects[0]); //将射线与模型的第一个交点push到rays数组中.
        }
    }
}

/**
 * 创建热点相关节点，添加样式并add到document.body中
 */

function addAnnotation() {
    var div; // 创建anno content的div
    var sp;
    var strong;
    var p;
    var num; // annotation的数量
    sp = document.createElement('p');
    strong = document.createElement('strong');
    p =  document.createElement('p');
    strong.type = 'text';
    div = document.createElement('div');
    div.className = 'annos';
    div.style.background = 'rgba(0, 0, 0, 0.8)';
    document.body.appendChild(div);
    annos.push(div);
    num = annos.length;

    strong.innerHTML = $('#recipient-name').val();
    p.innerHTML = $('#message-text').val();
    sp.appendChild(strong);
    sp.append(p);
    div.appendChild(sp);

    var x_point = rays[rays.length - 1].point.x.toFixed(2);  // 输出结果保留两位
    var y_point = rays[rays.length - 1].point.y.toFixed(2);  // 输出结果保留两位
    var z_point = rays[rays.length - 1].point.z.toFixed(2);  // 输出结果保留两位
    $.ajax({
        type: 'POST',
        url: './addAnnos.do',
        data:{
            // 'id'     : num, //回头这个地方的id可以都去掉，让数据库的id自增长
            'id'     : $('#recipient-id').val(),
            'title'  : $('#recipient-name').val(),
            'content': $('#message-text').val(),
            'x_point': x_point,
            'y_point': y_point,
            'z_point': z_point
        },
        // 考虑一下，如何把当前div对应的交点的下x,y,z值一起传过去
        success: function(data){
            $(div).attr('data-attr', $('#recipient-id').val());//操作伪dom中的内容，但是不能使用类选择器
            $(div).on('click', function hideAnno() {
                $(div).find("*").toggle('fast');
                if (div.style.background != '') {
                    div.style.background = '';
                } else {
                    div.style.background = 'rgba(0, 0, 0, 0.8)';
                }
            });
            // var v = window.getComputedStyle(div,'::before').getPropertyValue('content');
            // annos[i] 初始化结束后进行赋值
            $('#recipient-id').val("");
            $('#recipient-name').val("");
            $('#message-text').val("");
        }
    });
}

/**
 * 更新Annos屏幕中所处的位置
 * Annos不是编号1的annotation
 */
function updateAnnosPosition() {
    for (var i = 0; i < annos.length; i++){
        var canvas = renderer.domElement;
        //var vector = new THREE.Vector3(clientX,clientY,-1);
        // var vector = new THREE.Vector3(intersects[i].point.x, intersects[i].point.y, intersects[i].point.z);
        var vector = new THREE.Vector3(rays[i].point.x, rays[i].point.y, rays[i].point.z);
        vector.project(camera);
        //这个位置的写法有问题
        vector.x = Math.round((0.5 + vector.x / 2) * (canvas.width / window.devicePixelRatio)); // 控制annotation跟随物体一起旋转
        vector.y = Math.round((0.5 - vector.y / 2) * (canvas.height / window.devicePixelRatio));
        annos[i].style.left = vector.x + "px";
        annos[i].style.top = vector.y + "px";

        annos[i].style.opacity = spriteBehindObject ? 0.25 : 1;
    }
}
function loadExistAnnosPosition() {
    for (var k = 0 ; k < existAnnos.length; k++){
        var canvas = renderer.domElement;

        var vector = new THREE.Vector3(anno_data[k].x, anno_data[k].y, anno_data[k].z);
        vector.project(camera);
        vector.x = Math.round((0.5 + vector.x / 2) * (canvas.width / window.devicePixelRatio)); // 控制annotation跟随物体一起旋转
        vector.y = Math.round((0.5 - vector.y / 2) * (canvas.height / window.devicePixelRatio));
        existAnnos[k].style.left = vector.x + "px";
        existAnnos[k].style.top = vector.y + "px";

        existAnnos[k].style.opacity = spriteBehindObject ? 0.25 : 1;
    }

}

/* 修改注解屏幕位置函数体 实时更新，实际是三维坐标向屏幕坐标的映射，这个修改的是编号为1的annotation*/
/*function updateScreenPosition() {
    var canvas = renderer.domElement;

    var vector = new THREE.Vector3(150, 0, 0); // 控制annotation的位置，vector3是world坐标系下的坐标，右手系。
    vector.project(camera); //将向量投影到摄像机坐标系
    vector.x = Math.round((0.5 + vector.x / 2) * (canvas.width / window.devicePixelRatio)); // 控制annotation跟随物体一起旋转
    vector.y = Math.round((0.5 - vector.y / 2) * (canvas.height / window.devicePixelRatio));

    annotation.style.top = vector.y + "px";
    annotation.style.left = vector.x + "px";
    annotation.style.opacity = spriteBehindObject ? 0.25 : 1;
}*/

/* 修改注解透明度函数体 */
function updateAnnotationOpacity() {
    var objDistance = camera.position.distanceTo(mesh.position);
    var spriteDistance = camera.position.distanceTo(sprite.position);
    spriteBehindObject = spriteDistance > objDistance; //判断是否在模型的正面
    sprite.material.opacity = spriteBehindObject ? 0.25 : 1;

    // Do you want a number that changes size according to its position?
    // Comment out the following line and the `::before` pseudo-element.
    sprite.material.opacity = 0;
}

/**
 * 渲染器
 */
function render() {
    //stats.update();
    renderer.render(scene, camera);
    updateAnnotationOpacity(); // 修改注解的透明度
    //updateScreenPosition(); // 修改注解的屏幕位置
    if (annos != null){
        updateAnnosPosition();
    }
    if (anno_data != null){
        loadExistAnnosPosition();
    }

}
/**
 * 每个function对应一个热点
 */
/*function num1Btn() {
    var tween = new TWEEN.Tween(camera.position).to({ x: 678, y: 395, z: 389 }, 1000).start();

    $('.annos').find("*").toggle('slow');

    if (annotation.style.background != '') {

        annotation.style.background = '';

    } else {

        annotation.style.background = 'rgba(0, 0, 0, 0.8)';

    }
}*/
/**
 * 鼠标单击事件
 * @param {} event 
 */
function onDocumentMouseDown(event) {

    event.preventDefault();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    //TWEEN.update(); // 点击后触发更新视角
    render();
}
/**
 * 触摸屏
 */
function onDocumentTouchStart(event) {

    event.preventDefault();

    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    onDocumentMouseDown(event);

}

/**
 * light光照初始化
 */
function initLight() {
    // Lights
    var lights = [];

    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[1] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(1000, 2000, 1000);
    lights[1].position.set(-1000, -2000, -1000);
    return lights;
}
/**
 * 初始化控制器
 * 控制器相关参数的调整
 */
function initControl() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    //旋转速度
    controls.rotateSpeed = 0.25;
    //是否允许变焦
    controls.enableZoom = true;
    //变焦速度
    controls.zoomSpeed = 1.2;
    controls.enableDamping = true;
    controls.dampingFactor = 50;
    //是否允许相机平移 默认是false
    controls.enablePan = true;
    //动态阻尼系数 就是灵敏度
    controls.dampingFactor = 0.09;
}