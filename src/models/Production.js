class Production {
  constructor(obj) {
    obj = obj != null ? obj : {}
    this.id = obj.id != null ? obj.id : 0
    this.shiftcutId = obj.shiftcutId != null ? obj.shiftcutId : 0;
    this.locationId = obj.locationId != null ? obj.locationId : 0;
    this.docDatetime = obj.docDatetime != null ? obj.docDatetime : '';
    this.docNumber = obj.docNumber != null ? obj.docNumber : '';
    this.createdBy = obj.createdBy != null ? obj.createdBy : 0;
    this.isActive = obj.isActive != null ? obj.isActive : 0;
    this.isVoided = obj.isVoided != null ? obj.isVoided : 0;
    this.createdAt = obj.createdAt != null ? obj.createdAt : 0;
    this.updatedAt = obj.updatedAt != null ? obj.updatedAt : 0;
  }
}