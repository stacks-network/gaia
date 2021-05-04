EC2_INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
EC2_AZ=`curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone`
EC2_REGION="`echo \"$EC2_AZ\" | sed 's/[a-z]$//'`"

export_statement=$(aws ec2 describe-tags --region "$EC2_REGION" \
    --filters "Name=resource-id,Values=$EC2_INSTANCE_ID" \
    --query 'Tags[?!contains(Key, `:`)].[Key,Value]' \
    --output text | \
    sed -E 's/^([^\s\t]+)[\s\t]+([^\n]+)$/export \1="\2"/g')
eval $export_statement
