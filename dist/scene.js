"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
const fs_extra_1 = require("fs-extra");
const Const_1 = __importDefault(require("./Const"));
const fs = require('fs');
const path = require('path');
exports.methods = {
    async bind() {
        //@ts-ignore
        let NodeRoot = cc.director.getScene();
        let ids = Editor.Selection.getSelected('node');
        if (!ids || !ids.length) {
            console.log('未选中任何节点！，请先在资源管理器中双击打开要操作的Prefab');
        }
        else {
            for (const id of ids) {
                let node = this.getNode(NodeRoot, id);
                if (node) {
                    this.start(node);
                }
                else {
                    console.log("当前打开的不是Prefab");
                }
            }
        }
    },
    async start(NodeRoot) {
        let ProjectDir = Editor.Project.path;
        let ScriptName = NodeRoot.name;
        let resultName = `${ScriptName}_Layout`;
        let filePath = this.findFilePathByName(ProjectDir + "/assets/", ScriptName + ".prefab");
        Const_1.default.ScriptsDir = filePath;
        let ScriptPath = `${ProjectDir}/${filePath}/${ScriptName}_Layout.ts`.replace(/\\/g, "/");
        let nodeMaps = {};
        let importMaps = {};
        this.findNodes(NodeRoot, nodeMaps, importMaps);
        let _str_import = ``;
        for (let key in importMaps) {
            let path = this.getImportPath(importMaps[key], ScriptPath);
            if (!_str_import.includes(path))
                _str_import += `import ${key} from "${path}"\n`;
        }
        let _str_content = ``;
        let coms = '';
        for (let key in nodeMaps) {
            let com = nodeMaps[key];
            if (!coms.includes(com.constructor.name)) {
                coms += com.constructor.name + ',';
            }
            _str_content += `\t@property(${com.constructor.name})\n\t${key}: ${com.constructor.name};\n`;
        }
        let strScript = `
//pilihou 这个类是由autobind插件自动生成的！！！
//如果需要修改，请在${ScriptName}.prefab中修改，然后用autobind插件重新生成！！！
${_str_import}
import {Component,_decorator,${coms}} from "cc";
const {ccclass, property} = _decorator;
@ccclass('${resultName}')
export default class ${resultName} extends Component{
${_str_content} 
}`;
        this.checkScriptDir();
        let dbScriptPath = ScriptPath.replace(Editor.Project.path.replace(/\\/g, "/"), "db:/");
        let isExist = await Editor.Message.request('asset-db', 'query-asset-info', dbScriptPath);
        if (!isExist) {
            await Editor.Message.request('asset-db', 'create-asset', dbScriptPath, strScript);
            console.log('create: ', resultName + '脚本创建成功');
        }
        else {
            await Editor.Message.request('asset-db', 'save-asset', dbScriptPath, strScript);
        }
        let comp = NodeRoot.getComponent(resultName);
        if (!comp) {
            comp = NodeRoot.addComponent(resultName);
        }
        for (let key in nodeMaps) {
            comp[key] = nodeMaps[key];
        }
        console.log('节点绑定完成！');
    },
    findFilePathByName(directoryPath, fileName) {
        const oriPath = path.join(Editor.Project.path, "/");
        const files = fs.readdirSync(directoryPath); // 读取目录内容
        for (let file of files) {
            if (file === fileName) { // 判断当前遍历到的文件与要查找的文件名是否相同
                let resPath = directoryPath.replace(oriPath, "");
                return resPath; // 返回完整的文件路径
            }
            else if (fs.statSync(path.join(directoryPath, file)).isDirectory()) { // 若当前项为子目录则递归调用该函数
                const result = this.findFilePathByName(path.join(directoryPath, file), fileName);
                if (result !== null) {
                    return result; // 若找到符合条件的文件，直接返回结果
                }
            }
        }
        return null; // 未找到符合条件的文件时返回null
    },
    getNode(node, id) {
        for (const child of node.children) {
            if (child._id == id) {
                return child;
            }
            else {
                let node = this.getNode(child, id);
                if (node) {
                    return node;
                }
            }
        }
    },
    /** 计算相对路径 */
    getImportPath(exportPath, currPath) {
        exportPath = exportPath.replace(/\\/g, "/").substr(0, exportPath.lastIndexOf("."));
        currPath = currPath.replace(/\\/g, "/");
        let tmp = "./";
        let start, end;
        let exportStr = exportPath.split("/");
        let currStr = currPath.split("/");
        for (end = 0; end < exportStr.length; ++end) {
            if (exportStr[end] != currStr[end]) {
                break;
            }
        }
        for (start = end + 1; start < currStr.length; ++start) {
            tmp += "../";
        }
        for (start = end; start < exportStr.length; ++start) {
            tmp += `${exportStr[start]}/`;
        }
        tmp = tmp.substr(0, tmp.length - 1);
        return tmp;
    },
    checkScriptDir() {
        let floders = Const_1.default.ScriptsDir.split('/');
        let dir = Editor.Project.path;
        for (const floder of floders) {
            dir += '/' + floder;
            if (!(0, fs_extra_1.existsSync)(dir)) {
                (0, fs_extra_1.mkdirSync)(dir);
            }
        }
    },
    async findNodes(node, _nodeMaps, _importMaps) {
        let name = node.name;
        if (this.checkBindChildren(name)) {
            // 获得这个组件的类型 和 名称
            let names = this.getPrefixNames(name);
            if (names.length >= 2) {
                let type = Const_1.default.SeparatorMap[names[0]] || names[0];
                let propertyName = names[1];
                // 进入到这里， 就表示可以绑定了
                if (type === "cc.Node") {
                    _nodeMaps[propertyName] = node;
                }
                else {
                    let component = node.getComponent(type);
                    if (component) {
                        _nodeMaps[propertyName] = component;
                    }
                }
                // // 检查是否是自定义组件
                // if (!_importMaps[type.name] && type.name.indexOf("") === -1 && node.getComponent(type)) {
                //     
                //     let uuid = node.getComponent(type).__scriptUuid;
                //     let componentPath = await Editor.Message.request('asset-db','query-url',uuid);
                //     componentPath = componentPath.replace(/\s*/g, "").replace(/\\/g, "/");
                //     _importMaps[type.name] = componentPath;
                // }
            }
            // 绑定子节点
            node.children.forEach((target) => {
                this.findNodes(target, _nodeMaps, _importMaps);
            });
        }
    },
    /** 检查后缀 */
    checkBindChildren(name) {
        if (name[name.length - 1] !== Const_1.default.STANDARD_End) {
            return true;
        }
        return false;
    },
    /** 获得类型和name */
    getPrefixNames(name) {
        if (name === null) {
            return '';
        }
        return name.split(Const_1.default.STANDARD_Separator);
    }
};
