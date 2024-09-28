"use strict";
const { Model, ARRAY } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Issue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Issue.belongsTo(models.User, {
        foreignKey: "userId",
      });
    }
    static async addIssue(
      dateNum,
      secId,
      request,
      response,
      userId,
      uploadedFilePaths,
      category,
      department,
      urgency
    ) {
      try {
        const issue = await Issue.create({
          secondaryId: `${dateNum}-${category.substring(0, 3)}-${secId}`,
          title: request.body.title,
          desc: request.body.desc,
          department: department,
          category: category,
          urgency: urgency,
          completed: 1,
          userId: userId,
          imageLinks: uploadedFilePaths,
          station: request.body.station,
          platform: request.body.platform,
          pnrNo: request.body.pnrNo,
        });
        return issue;
      } catch (error) {
        console.log(error);
      }
    }
    static async setCompletionStatus(id) {
      const issue = await Issue.findByPk(id);
      issue.completed = 2;
      await issue.save();
      return issue;
    }
    static async remove(id) {
      return this.destroy({
        where: {
          id: id,
        },
      });
    }

    static async getIssues(userId) {
      console.log(`Querying for issues where userId = ${userId}`);
      return this.findAll({
        where: {
          userId: userId,
        },
      });
    }

    static async getAllIssues() {
      return this.findAll();
    }

    static async setFeedBack(id, feedback) {
      const issue = await Issue.findByPk(id);
      issue.feedback = feedback;
      await issue.save();
      return issue;
    }

    static async groupByDepartment() {
      const issues = await this.findAll({});
      const departmentMap = new Map();

      issues.forEach((issue) => {
        if (!departmentMap.has(issue.department)) {
          departmentMap.set(issue.department, []);
        }
        departmentMap.get(issue.department).push(issue);
      });

      // Sort each department's issues by urgency
      departmentMap.forEach((issuesArray, department) => {
        issuesArray.sort((a, b) => a.urgency - b.urgency);
      });

      return departmentMap;
    }
  }
  Issue.init(
    {
      secondaryId: DataTypes.STRING,
      title: DataTypes.STRING,
      desc: DataTypes.STRING,
      category: DataTypes.STRING,
      department: DataTypes.STRING,
      urgency: DataTypes.INTEGER,
      completed: DataTypes.INTEGER,
      imageLinks: ARRAY(DataTypes.STRING),
      feedback: DataTypes.STRING,
      station: DataTypes.STRING,
      platform: DataTypes.STRING,
      pnrNo: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Issue",
    }
  );
  return Issue;
};
